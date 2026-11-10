from pathlib import Path
import argparse,hashlib,json,re,plistlib,sys
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--update-web-manifest',action='store_true');args=p.parse_args()
web=root/'StarPets/web';manifest=root/'docs/shared-web-manifest.json'
android=root.parent/'star-pets-android'
ui=android/'ui/src'
assert (ui/'App.vue').is_file(), 'Missing shared UI source'
checks=[{'path':f.relative_to(web).as_posix(),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(web.rglob('*')) if f.is_file()]
for name in ['StarPets/Info.plist','StarPets/PrivacyInfo.xcprivacy']:plistlib.loads((root/name).read_bytes())
assert len(list(web.glob('assets/*.js')))>0,'Missing built frontend'
bridge=(root/'StarPets/Bridge.swift').read_text(encoding='utf-8')
text='\n'.join(f.read_text(encoding='utf-8-sig') for f in ui.rglob('*') if f.is_file() and f.suffix in {'.vue','.ts','.js'})
called=set(re.findall(r"native(?:<[^>]+>)?\(\s*['\"]([A-Za-z]+)['\"]",text))
called.discard('photoUpload') # Browser-only local preview upload, not native.
called.update(['login','bio','rememberLogin','forgetLogin','checkpoint','exportPhoto','albumPhoto','pickPhoto','camera','voiceInstall','voiceSettings','recordStart','recordStop','exportBackup','importBackup','importPet'])
missing=sorted(a for a in called if '"'+a+'"' not in bridge)
assert not missing,'Missing native bridge actions: '+','.join(missing)
for f in (root/'scripts').glob('*.sh'):assert b'\r' not in f.read_bytes(),f'CRLF shell script: {f.name}'
for f in root.glob('*.command'):assert b'\r' not in f.read_bytes(),f'CRLF launcher: {f.name}'
parity='NOT_RUN (Android Web resources absent)'
if (android/'assets/web').is_dir():
 other={f.relative_to(android/'assets/web').as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in (android/'assets/web').rglob('*') if f.is_file()}
 assert other=={x['path']:x['sha256'] for x in checks},'Android and iOS built UI differ'
 parity='PASS (same shared source and byte-identical Web resources)'
if args.update_web_manifest:
 manifest.write_text(json.dumps({'identical':parity.startswith('PASS'),'source':'star-pets-android/ui','files':len(checks),'checks':checks},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
expected=json.loads(manifest.read_text(encoding='utf-8'))['checks']
assert {x['path']:x['sha256'] for x in checks}=={x['path']:x['sha256'] for x in expected},'Web resources differ from recorded manifest'
report={'resourceManifest':'PASS','webFiles':len(checks),'bridgeActionCoverage':'PASS','actions':sorted(called),'androidUIParity':parity,'shellLineEndings':'PASS','nativeCompilation':'NOT_RUN by this script','deviceParity':'NOT_RUN by this script'}
(root/'docs/delivery-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
