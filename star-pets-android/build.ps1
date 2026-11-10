param([Parameter(Mandatory=$true)][string]$BuildTools,[Parameter(Mandatory=$true)][string]$AndroidJar,[Parameter(Mandatory=$true)][string]$SigningKey,[string]$Jdk='C:\Program Files\Java\jdk-22',[string]$OutputApk=(Join-Path $PSScriptRoot '..\星星宠物-Android-v1.1.0.apk'))
$ErrorActionPreference='Stop'
if(-not $env:STAR_STORE_PASSWORD){throw 'Set STAR_STORE_PASSWORD without putting it in source control'}
if(-not(Test-Path (Join-Path $PSScriptRoot 'assets/web/index.html'))){throw 'Run npm run build:web first'}
$env:JAVA_HOME=$Jdk
$env:PATH=(Join-Path $Jdk 'bin')+';'+$env:PATH
$run=Join-Path $PSScriptRoot ('build/run-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force "$run/classes","$run/dex" | Out-Null
$libraries=@(Get-ChildItem "$PSScriptRoot/libs" -Filter "*.jar" | ForEach-Object FullName)
$sources=@(Get-ChildItem -LiteralPath "$PSScriptRoot/src" -Filter '*.java' -Recurse -File | ForEach-Object FullName)
& "$Jdk/bin/javac.exe" -encoding UTF-8 -Xlint:-options -source 8 -target 8 -bootclasspath ($AndroidJar+';'+(Join-Path $BuildTools 'core-lambda-stubs.jar')) -classpath ($libraries -join ";") -d "$run/classes" @sources
if($LASTEXITCODE -ne 0){throw 'Java compile failed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory("$run/classes","$run/classes.jar")
& "$BuildTools/d8.bat" --release --min-api 28 --lib $AndroidJar --output "$run/dex" "$run/classes.jar" @libraries
if($LASTEXITCODE -ne 0){throw 'DEX conversion failed'}
& "$BuildTools/aapt2.exe" compile --dir "$PSScriptRoot/res" -o "$run/res.zip"
if($LASTEXITCODE -ne 0){throw 'Resource compilation failed'}
& "$BuildTools/aapt2.exe" link -I $AndroidJar --manifest "$PSScriptRoot/AndroidManifest.xml" -A "$PSScriptRoot/assets" -o "$run/unsigned.apk" "$run/res.zip"
if($LASTEXITCODE -ne 0){throw 'Resource link failed'}
$zip=[IO.Compression.ZipFile]::Open("$run/unsigned.apk",[IO.Compression.ZipArchiveMode]::Update)
try{
 foreach($e in @($zip.Entries)){
  if($e.FullName.Contains('\')){
   $name=$e.FullName.Replace('\','/');if($zip.GetEntry($name)){throw 'Duplicate asset path'}
   $m=[IO.MemoryStream]::new();$s=$e.Open();try{$s.CopyTo($m)}finally{$s.Dispose()};$e.Delete();$n=$zip.CreateEntry($name);$o=$n.Open();try{$m.Position=0;$m.CopyTo($o)}finally{$o.Dispose();$m.Dispose()}
  }
 }
 foreach($dex in Get-ChildItem "$run/dex" -Filter '*.dex'){[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$dex.FullName,$dex.Name) | Out-Null}
 foreach($so in Get-ChildItem "$PSScriptRoot/jniLibs" -Recurse -Filter '*.so'){$relative=$so.FullName.Substring((Join-Path $PSScriptRoot 'jniLibs').Length+1).Replace('\','/');[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$so.FullName,'lib/'+$relative) | Out-Null}
}finally{$zip.Dispose()}
& "$BuildTools/zipalign.exe" -f -p 4 "$run/unsigned.apk" "$run/aligned.apk"
if($LASTEXITCODE -ne 0){throw 'Alignment failed'}
& "$BuildTools/apksigner.bat" sign --ks $SigningKey --ks-key-alias star-pets --ks-pass env:STAR_STORE_PASSWORD --key-pass env:STAR_STORE_PASSWORD --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $OutputApk "$run/aligned.apk"
if($LASTEXITCODE -ne 0){throw 'Signing failed'}
& "$BuildTools/apksigner.bat" verify --verbose --print-certs $OutputApk
if($LASTEXITCODE -ne 0){throw 'Signature validation failed'}
& "$BuildTools/zipalign.exe" -c -p 4 $OutputApk
if($LASTEXITCODE -ne 0){throw 'Final alignment validation failed'}
Write-Output "APK: $OutputApk"
