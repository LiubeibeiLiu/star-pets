package app.starpets.local;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.hardware.biometrics.*;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.*;
import android.webkit.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.json.*;

public class MainActivity extends Activity {

  CompanionVoice voice;
  CompanionCloud cloud;
  static final String ORIGIN = "https://starpets.local";
  WebView web;
  Store db;
  android.content.SharedPreferences prefs;
  volatile boolean unlocked = false;
  boolean external = false;
  long stoppedAt = 0;
  ExecutorService worker = Executors.newSingleThreadExecutor();
  Handler main = new Handler();
  CancellationSignal bioCancel;
  MediaRecorder recorder;
  String recordName;
  String pendingId, pendingAction, captureName;
  JSONObject pendingArgs, staged;
  Map<String, byte[]> stagedFiles;
  File media;
  int failures = 0;
  long retryAt = 0;
  String permissionId;
  JSONObject permissionArgs;

  public void onCreate(Bundle b) {
    super.onCreate(b);
    db = new Store(this);
    prefs = getSharedPreferences("auth", MODE_PRIVATE);
    media = new File(getFilesDir(), "media");
    media.mkdirs();
    initPassword();
    web = new WebView(this);
    web.setVerticalScrollBarEnabled(false);
    web.setHorizontalScrollBarEnabled(false);
    setContentView(web);
    web.setBackgroundColor(Color.rgb(244, 241, 250));
    getWindow().setStatusBarColor(Color.rgb(244, 241, 250));
    getWindow().setNavigationBarColor(Color.rgb(244, 241, 250));
    getWindow()
      .getDecorView()
      .setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR |
        View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
      );
    web.setOnApplyWindowInsetsListener((v, i) -> {
      v.setPadding(
        i.getSystemWindowInsetLeft(),
        i.getSystemWindowInsetTop(),
        i.getSystemWindowInsetRight(),
        i.getSystemWindowInsetBottom()
      );
      return i.consumeSystemWindowInsets();
    });
    WebSettings w = web.getSettings();
    w.setJavaScriptEnabled(true);
    w.setDomStorageEnabled(false);
    w.setAllowFileAccess(false);
    w.setAllowContentAccess(false);
    w.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    w.setMediaPlaybackRequiresUserGesture(true);
    w.setSupportMultipleWindows(false);
    w.setJavaScriptCanOpenWindowsAutomatically(false);
    w.setTextZoom(100);
    web.addJavascriptInterface(new Bridge(), "StarNative");
    web.setWebViewClient(
      new WebViewClient() {
        public boolean shouldOverrideUrlLoading(
          WebView v,
          WebResourceRequest r
        ) {
          return true;
        }

        public WebResourceResponse shouldInterceptRequest(
          WebView v,
          WebResourceRequest r
        ) {
          return resource(r.getUrl());
        }
      }
    );
    web.setWebChromeClient(
      new WebChromeClient() {
        public boolean onConsoleMessage(ConsoleMessage m) {
          android.util.Log.d("StarPets", m.message());
          return true;
        }
      }
    );
    voice = new CompanionVoice(this);
    cloud = new CompanionCloud(this);
    web.loadUrl(ORIGIN + "/web/index.html");
    Reminders.schedule(this);
  }

  void initPassword() {
    if (prefs.contains("hash")) return;
    try (InputStream in = getAssets().open("bootstrap-auth.json")) {
      JSONObject j = new JSONObject(
        new String(read(in, 10000), StandardCharsets.UTF_8)
      );
      prefs
        .edit()
        .putString("salt", j.getString("salt"))
        .putString("hash", j.getString("hash"))
        .commit();
    } catch (Exception e) {
      throw new IllegalStateException("Missing bootstrap verifier", e);
    }
  }

  boolean verify(String p) throws Exception {
    if (
      System.currentTimeMillis() < prefs.getLong("retryAt", 0)
    ) throw new Exception("尝试过多，请稍后再试");
    byte[] salt = Base64.decode(prefs.getString("salt", ""), 0);
    PBEKeySpec spec = new PBEKeySpec(p.toCharArray(), salt, 120000, 256);
    byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      .generateSecret(spec)
      .getEncoded();
    spec.clearPassword();
    boolean ok = MessageDigest.isEqual(
      hash,
      Base64.decode(prefs.getString("hash", ""), 0)
    );
    if (ok) prefs.edit().putInt("failures", 0).putLong("retryAt", 0).commit();
    else {
      int n = prefs.getInt("failures", 0) + 1;
      prefs
        .edit()
        .putInt("failures", n)
        .putLong("retryAt", n % 5 == 0 ? System.currentTimeMillis() + 30000 : 0)
        .commit();
    }
    return ok;
  }

  void password(String p) throws Exception {
    if (p.length() < 8 || p.length() > 128) throw new Exception(
      "密码需为 8–128 位"
    );
    byte[] salt = new byte[24];
    new SecureRandom().nextBytes(salt);
    PBEKeySpec sp = new PBEKeySpec(p.toCharArray(), salt, 120000, 256);
    byte[] h = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
      .generateSecret(sp)
      .getEncoded();
    sp.clearPassword();
    if (
      !prefs
        .edit()
        .putString("salt", Base64.encodeToString(salt, 2))
        .putString("hash", Base64.encodeToString(h, 2))
        .commit()
    ) throw new Exception("密码保存失败");
  }

  WebResourceResponse resource(Uri u) {
    try {
      if (
        !"https".equals(u.getScheme()) || !"starpets.local".equals(u.getHost())
      ) return blocked();
      String path = u.getPath();
      if (
        path == null || path.contains("..") || path.contains("\\")
      ) return blocked();
      InputStream in;
      if (path.startsWith("/media/")) {
        if (!unlocked) return blocked();
        String name = path.substring(7);
        if (!name.matches("[a-f0-9-]+\\.(jpg|png|m4a)")) return blocked();
        in = new FileInputStream(new File(media, name));
      } else if (path.startsWith("/web/")) in = getAssets().open(
        path.substring(1)
      );
      else return blocked();
      String mime = path.endsWith(".html")
        ? "text/html"
        : path.endsWith(".js")
          ? "application/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : path.endsWith(".png")
              ? "image/png"
              : path.endsWith(".jpg")
                ? "image/jpeg"
                : path.endsWith(".m4a")
                  ? "audio/mp4"
                  : "application/octet-stream";
      Map<String, String> heads = new HashMap<>();
      heads.put("Cache-Control", "no-store");
      heads.put(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'"
      );
      return new WebResourceResponse(mime, "UTF-8", 200, "OK", heads, in);
    } catch (Exception e) {
      return blocked();
    }
  }

  WebResourceResponse blocked() {
    return new WebResourceResponse(
      "text/plain",
      "UTF-8",
      403,
      "Forbidden",
      Collections.emptyMap(),
      new ByteArrayInputStream(new byte[0])
    );
  }

  void reply(String id, Object data, Exception e) {
    main.post(() -> {
      if (web != null) web.evaluateJavascript(
        "window.nativeReply(" +
        JSONObject.quote(id) +
        "," +
        (e == null
            ? "null"
            : JSONObject.quote(
              e.getMessage() == null ? "操作未完成" : e.getMessage()
            )) +
        "," +
        (data == null ? "null" : data.toString()) +
        ")",
        null
      );
    });
  }

  JSONObject obj(String k, Object v) throws Exception {
    return new JSONObject().put(k, v);
  }

  static final long REMEMBER_MS = 7L * 24 * 60 * 60 * 1000;

  boolean rememberedFresh() {
    if (!prefs.contains("rememberedPassword")) return false;
    long at = prefs.getLong("rememberedAt", 0);
    if (at <= 0 || System.currentTimeMillis() - at > REMEMBER_MS) {
      prefs.edit().remove("rememberedPassword").remove("rememberedAt").commit();
      return false;
    }
    return true;
  }

  class Bridge {

    @JavascriptInterface
    public void request(String id, String action, String raw) {
      if (
        id == null || id.length() > 80 || raw == null || raw.length() > 45000000
      ) return;
      worker.execute(() -> {
        try {
          JSONObject a = new JSONObject(raw);
          if (action.equals("status")) {
            JSONObject j = new JSONObject();
            j.put("authenticated", unlocked);
            j.put("biometric", prefs.getBoolean("bio", true));
            j.put("bioAvailable", bioAvailable());
            j.put("remembered", rememberedFresh());
            j.put("version", "1.1.0");
            j.put(
              "notifications",
              Build.VERSION.SDK_INT < 33 ||
              checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
              PackageManager.PERMISSION_GRANTED
            );
            reply(id, j, null);
            return;
          }
          if (action.equals("systemBars")) {
            String hex = a.optString("color", "");
            if (!hex.matches("#[0-9a-fA-F]{6}")) throw new Exception(
              "颜色无效"
            );
            int color = Color.parseColor(hex);
            boolean dark = a.optBoolean("dark", false);
            main.post(() -> {
              web.setBackgroundColor(color);
              getWindow().setStatusBarColor(color);
              getWindow().setNavigationBarColor(color);
              getWindow()
                .getDecorView()
                .setSystemUiVisibility(
                  dark
                    ? 0
                    : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR |
                    View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                );
            });
            reply(id, obj("ok", true), null);
            return;
          }
          if (action.equals("login")) {
            String password = a.getString("password");
            if (!verify(password)) {
              prefs
                .edit()
                .remove("rememberedPassword")
                .remove("rememberedAt")
                .commit();
              throw new Exception("密码不正确");
            }
            if (a.optBoolean("remember")) {
              if (
                !prefs
                  .edit()
                  .putString("rememberedPassword", cloud.encrypt(password))
                  .putLong("rememberedAt", System.currentTimeMillis())
                  .commit()
              ) throw new Exception("记住密码失败");
            } else prefs
              .edit()
              .remove("rememberedPassword")
              .remove("rememberedAt")
              .commit();
            unlocked = true;
            reply(id, obj("ok", true), null);
            return;
          }
          if (action.equals("rememberLogin")) {
            if (!rememberedFresh()) throw new Exception(
              "保存的密码已超过 7 天，请重新输入"
            );
            String saved = prefs.getString("rememberedPassword", "");
            String password;
            try {
              password = cloud.decrypt(saved);
            } catch (Exception e) {
              prefs
                .edit()
                .remove("rememberedPassword")
                .remove("rememberedAt")
                .commit();
              throw new Exception("保存的密码不可用，请重新输入");
            }
            if (!verify(password)) {
              prefs
                .edit()
                .remove("rememberedPassword")
                .remove("rememberedAt")
                .commit();
              throw new Exception("密码已变化，请重新输入");
            }
            unlocked = true;
            reply(id, obj("ok", true), null);
            return;
          }
          if (action.equals("forgetLogin")) {
            if (
              !prefs
                .edit()
                .remove("rememberedPassword")
                .remove("rememberedAt")
                .commit()
            ) throw new Exception("清除已记住密码失败");
            reply(id, obj("ok", true), null);
            return;
          }
          if (action.equals("bio")) {
            if (!prefs.getBoolean("bio", true)) throw new Exception(
              "请先用密码登录并开启生物识别"
            );
            main.post(() -> biometric(id, false));
            return;
          }
          if (!unlocked) throw new Exception("请先解锁应用");
          switch (action) {
            case "aiConfig":
              reply(id, cloud.config(), null);
              break;
            case "aiConfigSave":
              cloud.save(a);
              reply(id, obj("ok", true), null);
              break;
            case "aiKeyClear":
              cloud.clear(a);
              reply(id, obj("ok", true), null);
              break;
            case "aiTest":
              cloud.request(id, a, true);
              break;
            case "chat":
              cloud.request(id, a, false);
              break;
            case "voiceRefresh":
              main.post(() -> voice.initialize(id));
              break;
            case "voiceStatus":
              main.post(() -> {
                try {
                  reply(id, voice.status(), null);
                } catch (Exception e) {
                  reply(id, null, e);
                }
              });
              break;
            case "voiceListen":
              main.post(() ->
                voice.listen(id, a.optString("language", "zh-CN"))
              );
              break;
            case "voiceStop":
              main.post(() -> {
                voice.stop();
                reply(id, new JSONObject(), null);
              });
              break;
            case "voiceCancel":
              main.post(() -> {
                voice.cancel();
                cloud.cancel();
                reply(id, new JSONObject(), null);
              });
              break;
            case "voiceSpeak":
              main.post(() -> voice.speak(id, a));
              break;
            case "voiceInstall":
            case "voiceSettings":
              main.post(() -> {
                try {
                  Intent settings = new Intent(
                    "com.android.settings.TTS_SETTINGS"
                  );
                  if (
                    action.equals("voiceInstall") &&
                    voice.tts != null &&
                    voice.tts.getDefaultEngine() != null
                  ) {
                    try {
                      startActivity(
                        new Intent(
                          android.speech.tts.TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA
                        ).setPackage(voice.tts.getDefaultEngine())
                      );
                      reply(id, new JSONObject(), null);
                      return;
                    } catch (ActivityNotFoundException ignored) {}
                  }
                  try {
                    startActivity(settings);
                  } catch (ActivityNotFoundException e) {
                    startActivity(
                      new Intent(
                        android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS
                      )
                    );
                  }
                  reply(id, new JSONObject(), null);
                } catch (Exception e) {
                  reply(
                    id,
                    null,
                    new Exception(
                      "请在系统设置搜索文字转语音，安装支持中英文离线合成的引擎与声音"
                    )
                  );
                }
              });
              break;
            case "load":
              reply(id, db.read(), null);
              break;
            case "checkpoint":
              staged = db.checkpoint();
              stagedFiles = new HashMap<>();
              reply(id, obj("state", staged), null);
              break;
            case "save":
              db.save(a.getJSONObject("state"), a.getInt("expected"), false);
              Reminders.schedule(MainActivity.this);
              reply(id, obj("ok", true), null);
              break;
            case "logout":
              unlocked = false;
              main.post(() -> voice.cancel());
              cloud.cancel();
              reply(id, obj("ok", true), null);
              break;
            case "password":
              if (!verify(a.getString("old"))) throw new Exception(
                "原密码不正确"
              );
              password(a.getString("value"));
              prefs
                .edit()
                .remove("rememberedPassword")
                .remove("rememberedAt")
                .commit();
              reply(id, obj("ok", true), null);
              break;
            case "enableBio":
              if (!a.getBoolean("enabled")) {
                prefs.edit().putBoolean("bio", false).commit();
                reply(id, obj("ok", true), null);
              } else main.post(() -> biometric(id, true));
              break;
            case "recordStart":
              main.post(() -> recordStart(id));
              break;
            case "recordStop":
              main.post(() -> recordStop(id));
              break;
            case "pickPhoto":
            case "camera":
            case "exportBackup":
            case "importBackup":
            case "importPet":
            case "exportPhoto":
            case "exportAudio":
              main.post(() -> launchFile(id, action, a));
              break;
            case "albumPhoto": {
              if (Build.VERSION.SDK_INT < 29) {
                main.post(() -> launchFile(id, "exportPhoto", a));
                break;
              }
              String name = a.getString("file");
              if (!name.matches("[a-f0-9-]+\\.jpg")) throw new Exception(
                "照片无效"
              );
              saveToAlbum(
                read(new FileInputStream(new File(media, name)), 25000000),
                name
              );
              reply(id, obj("ok", true), null);
              break;
            }
            case "savePhoto": {
              String encoded = a.getString("data");
              if (encoded.length() > 22000000) throw new Exception("照片过大");
              byte[] bytes = Base64.decode(encoded, 0);
              String photoId = a.optString("photoId", "");
              if (
                !photoId.isEmpty() && !photoId.matches("[a-f0-9-]{1,64}")
              ) throw new Exception("照片编号无效");
              String name =
                (photoId.isEmpty() ? UUID.randomUUID().toString() : photoId) +
                ".jpg";
              File target = new File(media, name);
              byte[] image = target.exists()
                ? read(new FileInputStream(target), 25000000)
                : normalizeImage(bytes);
              if (!target.exists()) write(target, image);
              JSONObject saved = obj("file", name);
              try {
                saveToAlbum(image, name);
                saved.put("albumSaved", true);
              } catch (Exception e) {
                saved.put("albumSaved", false);
              }
              reply(id, saved, null);
              break;
            }
            case "restoreCommit": {
              if (staged == null) throw new Exception("没有待恢复备份");
              JSONObject body = a.getJSONObject("state");
              if (body.getInt("schema") != 1) throw new Exception(
                "不支持此备份"
              );
              for (Map.Entry<String, byte[]> e : stagedFiles.entrySet()) {
                File file = new File(media, e.getKey());
                if (
                  file.exists() &&
                  !Arrays.equals(
                    read(new FileInputStream(file), 25000000),
                    e.getValue()
                  )
                ) throw new Exception("资源编号冲突，原数据未覆盖");
                if (!file.exists()) write(file, e.getValue());
              }
              db.save(body, a.getInt("expected"), true);
              staged = null;
              stagedFiles = null;
              Reminders.schedule(MainActivity.this);
              reply(id, obj("ok", true), null);
              break;
            }
            case "notifications":
              main.post(() -> {
                if (
                  Build.VERSION.SDK_INT >= 33 &&
                  checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                  PackageManager.PERMISSION_GRANTED
                ) {
                  permissionId = id;
                  requestPermissions(
                    new String[] { Manifest.permission.POST_NOTIFICATIONS },
                    91
                  );
                } else reply(id, new JSONObject(), null);
              });
              break;
            default:
              throw new Exception("不支持的操作");
          }
        } catch (Exception e) {
          reply(id, null, e);
        }
      });
    }
  }

  boolean bioAvailable() {
    if (Build.VERSION.SDK_INT >= 29) return (
      getSystemService(BiometricManager.class).canAuthenticate() ==
      BiometricManager.BIOMETRIC_SUCCESS
    );
    return getPackageManager().hasSystemFeature(
      PackageManager.FEATURE_FINGERPRINT
    );
  }

  void biometric(String id, boolean enable) {
    if (!bioAvailable()) {
      reply(id, null, new Exception("手机未配置可用的生物识别，请使用密码"));
      return;
    }
    bioCancel = new CancellationSignal();
    new BiometricPrompt.Builder(this)
      .setTitle("解锁星星宠物")
      .setSubtitle("使用手机已登记的指纹或面容")
      .setNegativeButton("使用密码", getMainExecutor(), (d, w) ->
        reply(id, null, new Exception("已取消，可使用密码登录"))
      )
      .build()
      .authenticate(
        bioCancel,
        getMainExecutor(),
        new BiometricPrompt.AuthenticationCallback() {
          public void onAuthenticationSucceeded(
            BiometricPrompt.AuthenticationResult r
          ) {
            unlocked = true;
            if (enable) prefs.edit().putBoolean("bio", true).commit();
            reply(id, new JSONObject(), null);
          }

          public void onAuthenticationError(int n, CharSequence msg) {
            reply(id, null, new Exception(msg.toString()));
          }
        }
      );
  }

  void recordStart(String id) {
    if (voice.capturing || voice.speakId != null) {
      reply(id, null, new Exception("请先结束语音聊天"));
      return;
    }
    if (recorder != null) {
      reply(id, null, new Exception("正在录音"));
      return;
    }
    if (
      checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      permissionId = id;
      requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, 90);
      return;
    }
    try {
      recordName = UUID.randomUUID() + ".m4a";
      recorder = new MediaRecorder();
      recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
      recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
      recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
      recorder.setAudioEncodingBitRate(96000);
      recorder.setAudioSamplingRate(44100);
      recorder.setOutputFile(new File(media, recordName).getAbsolutePath());
      recorder.setMaxDuration(60000);
      recorder.setOnInfoListener((mr, what, extra) -> {
        if (
          what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED
        ) recordStop(null);
      });
      recorder.prepare();
      recorder.start();
      reply(id, new JSONObject(), null);
    } catch (Exception e) {
      releaseRecorder();
      reply(id, null, new Exception("录音未启动，请检查麦克风权限"));
    }
  }

  void releaseRecorder() {
    if (recorder != null) {
      try {
        recorder.release();
      } catch (Exception ignored) {}
      recorder = null;
    }
  }

  void recordStop(String id) {
    if (recorder == null) {
      if (id != null) reply(id, null, new Exception("没有正在进行的录音"));
      return;
    }
    try {
      recorder.stop();
      releaseRecorder();
      JSONObject data = obj("file", recordName);
      if (id != null) reply(id, data, null);
      else web.evaluateJavascript(
        "window.recordFinished(" + data.toString() + ")",
        null
      );
    } catch (Exception e) {
      releaseRecorder();
      if (id != null) reply(id, null, new Exception("录音过短，请重新录制"));
      else web.evaluateJavascript("window.recordFinished({file:''})", null);
    }
  }

  public void onRequestPermissionsResult(int r, String[] p, int[] g) {
    super.onRequestPermissionsResult(r, p, g);
    if (r == 92) {
      voice.permission(
        g.length > 0 && g[0] == PackageManager.PERMISSION_GRANTED
      );
      return;
    }
    String id = permissionId;
    permissionId = null;
    if (id == null) return;
    if (g.length == 0 || g[0] != PackageManager.PERMISSION_GRANTED) {
      reply(id, null, new Exception("权限未开启，其余功能仍可使用"));
      return;
    }
    if (r == 90) recordStart(id);
    else reply(id, new JSONObject(), null);
  }

  void saveToAlbum(byte[] image, String name) throws Exception {
    if (Build.VERSION.SDK_INT < 29) throw new Exception(
      "此系统请使用导出照片保存到相册"
    );
    String display = "StarPets-" + name;
    try (
      android.database.Cursor found = getContentResolver().query(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        new String[] { MediaStore.Images.Media._ID },
        MediaStore.Images.Media.DISPLAY_NAME +
        "=? AND " +
        MediaStore.Images.Media.RELATIVE_PATH +
        "=? AND " +
        MediaStore.Images.Media.IS_PENDING +
        "=0",
        new String[] { display, "Pictures/StarPets/" },
        null
      )
    ) {
      if (found != null && found.moveToFirst()) return;
    }
    ContentValues values = new ContentValues();
    values.put(MediaStore.Images.Media.DISPLAY_NAME, display);
    values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
    values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/StarPets");
    values.put(MediaStore.Images.Media.IS_PENDING, 1);
    Uri uri = getContentResolver().insert(
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      values
    );
    if (uri == null) throw new Exception("相册不可用");
    try {
      try (OutputStream out = getContentResolver().openOutputStream(uri)) {
        if (out == null) throw new Exception("无法写入相册");
        out.write(image);
      }
      values.clear();
      values.put(MediaStore.Images.Media.IS_PENDING, 0);
      if (
        getContentResolver().update(uri, values, null, null) < 1
      ) throw new Exception("相册保存未完成");
    } catch (Exception e) {
      getContentResolver().delete(uri, null, null);
      throw e;
    }
  }

  void launchFile(String id, String action, JSONObject a) {
    if (pendingId != null) {
      reply(id, null, new Exception("请先完成当前文件操作"));
      return;
    }
    try {
      Intent i;
      int req;
      if (action.equals("camera")) {
        captureName = UUID.randomUUID() + ".jpg";
        new File(getCacheDir(), captureName).createNewFile();
        Uri uri = Uri.parse(
          "content://app.starpets.local.capture/" + captureName
        );
        i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        i.putExtra(MediaStore.EXTRA_OUTPUT, uri);
        i.addFlags(
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
          Intent.FLAG_GRANT_READ_URI_PERMISSION
        );
        i.setClipData(ClipData.newRawUri("photo", uri));
        req = 81;
      } else if (
        action.equals("exportBackup") ||
        action.equals("exportPhoto") ||
        action.equals("exportAudio")
      ) {
        i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(
          action.equals("exportAudio")
            ? "audio/mp4"
            : action.equals("exportPhoto") ? "image/jpeg" : "application/zip"
        );
        i.putExtra(
          Intent.EXTRA_TITLE,
          action.equals("exportAudio")
            ? "星星宠物语音.m4a"
            : action.equals("exportPhoto")
              ? "星星宠物合照.jpg"
              : "星星宠物-" +
              new java.text.SimpleDateFormat(
                "yyyyMMdd-HHmm",
                Locale.ROOT
              ).format(new Date()) +
              ".starbackup"
        );
        req = 82;
      } else {
        i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(action.equals("pickPhoto") ? "image/*" : "*/*");
        req = 83;
      }
      pendingId = id;
      pendingAction = action;
      pendingArgs = a;
      external = true;
      startActivityForResult(i, req);
    } catch (Exception e) {
      pendingId = null;
      external = false;
      reply(id, null, new Exception("没有可用的相机或文件选择器"));
    }
  }

  protected void onActivityResult(int request, int result, Intent intent) {
    super.onActivityResult(request, result, intent);
    String id = pendingId,
      action = pendingAction;
    JSONObject a = pendingArgs;
    pendingId = null;
    external = false;
    if (id == null) return;
    if (result != RESULT_OK) {
      reply(id, null, new Exception("已取消"));
      return;
    }
    worker.execute(() -> {
      try {
        if (action.equals("camera") || action.equals("pickPhoto")) {
          byte[] b = action.equals("camera")
            ? read(
              new FileInputStream(new File(getCacheDir(), captureName)),
              25000000
            )
            : read(
              getContentResolver().openInputStream(intent.getData()),
              25000000
            );
          String name = UUID.randomUUID() + ".jpg";
          write(new File(media, name), normalizeImage(b));
          reply(id, obj("file", name), null);
        } else if (action.equals("exportBackup")) {
          JSONObject state = db.read();
          if (state == null) throw new Exception("尚无数据");
          try (
            OutputStream out = getContentResolver().openOutputStream(
              intent.getData()
            );
            ZipOutputStream z = new ZipOutputStream(out)
          ) {
            putZip(
              z,
              "data.json",
              state.toString().getBytes(StandardCharsets.UTF_8)
            );
            for (File f : media.listFiles()) {
              if (
                f.isFile() && f.getName().matches("[a-f0-9-]+\\.(jpg|png|m4a)")
              ) putZip(
                z,
                "media/" + f.getName(),
                read(new FileInputStream(f), 25000000)
              );
            }
          }
          reply(id, new JSONObject(), null);
        } else if (action.equals("exportAudio")) {
          String n = a.getString("file");
          if (!n.matches("[a-f0-9-]+\\.m4a")) throw new Exception("录音无效");
          try (
            OutputStream out = getContentResolver().openOutputStream(
              intent.getData()
            )
          ) {
            out.write(read(new FileInputStream(new File(media, n)), 25000000));
          }
          reply(id, new JSONObject(), null);
        } else if (action.equals("exportPhoto")) {
          String n = a.getString("file");
          if (!n.matches("[a-f0-9-]+\\.jpg")) throw new Exception("照片无效");
          try (
            OutputStream out = getContentResolver().openOutputStream(
              intent.getData()
            )
          ) {
            out.write(read(new FileInputStream(new File(media, n)), 25000000));
          }
          reply(id, new JSONObject(), null);
        } else if (action.equals("importBackup")) {
          Map<String, byte[]> files = unzip(
            getContentResolver().openInputStream(intent.getData())
          );
          byte[] doc = files.remove("data.json");
          if (doc == null) throw new Exception("缺少数据文件");
          JSONObject data = new JSONObject(
            new String(doc, StandardCharsets.UTF_8)
          );
          Store.validate(data);
          Map<String, byte[]> safe = new HashMap<>();
          for (Map.Entry<String, byte[]> e : files.entrySet()) {
            if (
              !e.getKey().matches("media/[a-f0-9-]+\\.(jpg|png|m4a)")
            ) throw new Exception("备份包含未知文件");
            safe.put(e.getKey().substring(6), e.getValue());
          }
          checkMedia(data, safe);
          staged = data;
          stagedFiles = safe;
          reply(id, obj("state", data), null);
        } else if (action.equals("importPet")) {
          Map<String, byte[]> fs = unzip(
            getContentResolver().openInputStream(intent.getData())
          );
          byte[] desc = fs.get("pet.json"),
            pic = fs.get("sheet.png");
          if (
            desc == null || pic == null || fs.size() != 2
          ) throw new Exception("宠物包需且只能包含 pet.json 和 sheet.png");
          JSONObject p = new JSONObject(
            new String(desc, StandardCharsets.UTF_8)
          );
          if (
            p.getInt("schema") != 1 ||
            !p.getString("id").matches("custom-[a-z0-9-]{1,40}") ||
            p.getInt("version") < 1 ||
            p.getInt("frames") != 5
          ) throw new Exception("宠物包规范不匹配");
          for (String k : new String[] { "name", "adult", "description" })
            if (p.getString(k).length() > 200) throw new Exception(
              "宠物文字过长"
            );
          BitmapFactory.Options bo = new BitmapFactory.Options();
          bo.inJustDecodeBounds = true;
          BitmapFactory.decodeByteArray(pic, 0, pic.length, bo);
          if (
            bo.outWidth < 500 ||
            bo.outWidth > 10000 ||
            bo.outHeight < 100 ||
            bo.outHeight > 3000 ||
            bo.outWidth < bo.outHeight * 3
          ) throw new Exception("图片需为 5 列横向 PNG，尺寸不合规范");
          if (!"image/png".equals(bo.outMimeType)) throw new Exception(
            "宠物图片必须为 PNG"
          );
          String name = UUID.randomUUID() + ".png";
          write(new File(media, name), pic);
          JSONObject def = new JSONObject();
          for (String k : new String[] {
            "id",
            "name",
            "adult",
            "description",
            "version",
            "frames",
          })
            def.put(k, p.get(k));
          def.put("sheet", "/media/" + name);
          def.put("color", "#b5a4db");
          def.put("tag", "导入伙伴");
          reply(id, obj("pet", def), null);
        }
      } catch (Exception e) {
        reply(id, null, e);
      }
    });
  }

  static void checkMedia(JSONObject j, Map<String, byte[]> files)
    throws Exception {
    JSONArray a = j.getJSONArray("memories");
    for (int i = 0; i < a.length(); i++) {
      JSONObject m = a.getJSONObject(i);
      String n = m.optString("file");
      if (!n.isEmpty() && !files.containsKey(n)) throw new Exception(
        "备份缺少纪念册媒体：" + n
      );
    }
    JSONArray ps = j.getJSONArray("imports");
    for (int i = 0; i < ps.length(); i++) {
      String path = ps.getJSONObject(i).getString("sheet");
      if (
        !path.matches("/media/[a-f0-9-]+\\.png") ||
        !files.containsKey(path.substring(7))
      ) throw new Exception("缺少导入宠物素材");
    }
  }

  static Map<String, byte[]> unzip(InputStream in) throws Exception {
    Map<String, byte[]> r = new HashMap<>();
    long total = 0;
    try (ZipInputStream z = new ZipInputStream(in)) {
      ZipEntry e;
      while ((e = z.getNextEntry()) != null) {
        if (e.isDirectory()) continue;
        String n = e.getName();
        if (
          n.contains("..") ||
          n.contains("\\") ||
          n.startsWith("/") ||
          r.containsKey(n) ||
          r.size() > 2000
        ) throw new Exception("压缩包路径或文件数量无效");
        byte[] b = readEntry(z, 32000000);
        total += b.length;
        if (total > 250000000) throw new Exception("备份超过 250MB");
        r.put(n, b);
      }
    }
    return r;
  }

  static byte[] readEntry(InputStream in, int max) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] b = new byte[8192];
    int n,
      total = 0;
    while ((n = in.read(b)) != -1) {
      total += n;
      if (total > max) throw new IOException("文件超过大小限制");
      out.write(b, 0, n);
    }
    return out.toByteArray();
  }

  static byte[] read(InputStream in, int max) throws IOException {
    try (InputStream stream = in) {
      return readEntry(stream, max);
    }
  }

  static void write(File f, byte[] b) throws IOException {
    File tmp = new File(f.getParentFile(), f.getName() + ".tmp");
    try (FileOutputStream o = new FileOutputStream(tmp)) {
      o.write(b);
      o.getFD().sync();
    }
    if (!tmp.renameTo(f)) throw new IOException("文件保存失败");
  }

  static void putZip(ZipOutputStream z, String n, byte[] b) throws IOException {
    z.putNextEntry(new ZipEntry(n));
    z.write(b);
    z.closeEntry();
  }

  static byte[] normalizeImage(byte[] b) throws Exception {
    BitmapFactory.Options o = new BitmapFactory.Options();
    o.inJustDecodeBounds = true;
    BitmapFactory.decodeByteArray(b, 0, b.length, o);
    if (o.outWidth <= 0 || o.outHeight <= 0) throw new Exception(
      "无法读取图片"
    );
    o.inSampleSize = 1;
    while (
      Math.max(o.outWidth, o.outHeight) / o.inSampleSize > 1800
    ) o.inSampleSize *= 2;
    o.inJustDecodeBounds = false;
    Bitmap bitmap = BitmapFactory.decodeByteArray(b, 0, b.length, o);
    if (bitmap == null) throw new Exception("图片解码失败");
    try {
      ExifInterface ex = new ExifInterface(new ByteArrayInputStream(b));
      int orientation = ex.getAttributeInt(ExifInterface.TAG_ORIENTATION, 1);
      Matrix m = new Matrix();
      switch (orientation) {
        case 2:
          m.setScale(-1, 1);
          break;
        case 3:
          m.setRotate(180);
          break;
        case 4:
          m.setScale(1, -1);
          break;
        case 5:
          m.setRotate(90);
          m.postScale(-1, 1);
          break;
        case 6:
          m.setRotate(90);
          break;
        case 7:
          m.setRotate(270);
          m.postScale(-1, 1);
          break;
        case 8:
          m.setRotate(270);
          break;
      }
      if (!m.isIdentity()) bitmap = Bitmap.createBitmap(
        bitmap,
        0,
        0,
        bitmap.getWidth(),
        bitmap.getHeight(),
        m,
        true
      );
    } catch (IOException ignored) {}
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out);
    bitmap.recycle();
    return out.toByteArray();
  }

  protected void onStop() {
    super.onStop();
    if (voice != null) voice.cancel();
    if (cloud != null) cloud.cancel();
    stoppedAt = System.currentTimeMillis();
    if (recorder != null) recordStop(null);
    if (bioCancel != null) bioCancel.cancel();
    web.onPause();
  }

  protected void onStart() {
    super.onStart();
    if (web == null) return;
    web.onResume();
    try {
      JSONObject state = db.read();
      int minutes = state == null
        ? 5
        : state.getJSONObject("settings").optInt("lockMinutes", 5);
      if (
        stoppedAt > 0 &&
        !external &&
        (System.currentTimeMillis() - stoppedAt >= minutes * 60000L)
      ) {
        unlocked = false;
        web.evaluateJavascript("window.lockApp && window.lockApp()", null);
      }
    } catch (Exception ignored) {
      unlocked = false;
    }
    stoppedAt = 0;
  }

  public void onBackPressed() {
    web.evaluateJavascript("window.appBack && window.appBack()", null);
  }

  protected void onDestroy() {
    releaseRecorder();
    if (voice != null) voice.destroy();
    if (cloud != null) cloud.destroy();
    if (bioCancel != null) bioCancel.cancel();
    worker.shutdown();
    super.onDestroy();
  }
}
