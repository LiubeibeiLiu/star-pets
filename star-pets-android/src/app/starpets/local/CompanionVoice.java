package app.starpets.local;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.*;
import android.os.*;
import android.speech.tts.*;
import com.k2fsa.sherpa.onnx.*;
import java.io.*;
import java.nio.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Audio stays in this process. ASR never uses a recognition service or network. */
final class CompanionVoice {

  final MainActivity h;
  final ExecutorService audio = Executors.newSingleThreadExecutor();
  TextToSpeech tts;
  volatile boolean ttsReady = false,
    capturing = false,
    processing = false;
  volatile int generation = 0;
  volatile AudioRecord mic;
  volatile AudioTrack player;
  String asrId, waitingId, waitingLanguage, speakId, speakTurn;
  File speechFile;
  AudioFocusRequest focus;

  CompanionVoice(MainActivity host) {
    h = host;
    initialize(null);
  }

  void initialize(String id) {
    cancel();
    ttsReady = false;
    if (tts != null) tts.shutdown();
    final boolean[] replied = { false };
    tts = new TextToSpeech(h, result -> {
      ttsReady = result == TextToSpeech.SUCCESS;
      if (id != null) h.main.post(() -> {
        if (replied[0]) return;
        replied[0] = true;
        try {
          h.reply(id, status(), null);
        } catch (Exception e) {
          h.reply(id, null, e);
        }
      });
    });
    if (id != null) h.main.postDelayed(
      () -> {
        if (!replied[0]) {
          replied[0] = true;
          h.reply(
            id,
            null,
            new Exception(
              "语音引擎未就绪，请打开系统语音设置检查引擎后重新检测"
            )
          );
        }
      },
      8000
    );
    tts.setOnUtteranceProgressListener(
      new UtteranceProgressListener() {
        public void onStart(String u) {}

        public void onDone(String u) {
          h.main.post(() -> {
            if (u.equals(speakTurn) && speechFile != null) {
              final int g = generation;
              final File f = speechFile;
              audio.execute(() -> playFile(f, u, g));
            }
          });
        }

        public void onError(String u) {
          h.main.post(() -> {
            if (u.equals(speakTurn)) finishSpeech(
              new Exception("本地语音合成未完成，请检查离线语音包")
            );
          });
        }

        public void onError(String u, int code) {
          h.main.post(() -> {
            if (u.equals(speakTurn)) finishSpeech(
              new Exception(
                code == TextToSpeech.ERROR_NOT_INSTALLED_YET
                  ? "语音引擎报告声音数据尚未就绪，请在系统语音设置完成下载"
                  : "语音合成失败（引擎错误 " +
                  code +
                  "），请在语音包管理中试听检查"
              )
            );
          });
        }
      }
    );
  }

  boolean matches(Locale locale, String language) {
    String code = locale.getLanguage().toLowerCase(Locale.ROOT);
    return language.startsWith("en")
      ? (code.equals("en") || code.equals("eng"))
      : (code.equals("zh") ||
        code.equals("zho") ||
        code.equals("chi") ||
        code.equals("cmn"));
  }

  Locale locale(String language) {
    return language.startsWith("en") ? Locale.US : Locale.SIMPLIFIED_CHINESE;
  }

  int availability(String language) {
    return ttsReady
      ? tts.isLanguageAvailable(locale(language))
      : TextToSpeech.ERROR;
  }

  Voice voice(String language) {
    if (!ttsReady || tts.getVoices() == null) return null;
    Voice best = null;
    int score = -1;
    for (Voice v : tts.getVoices()) {
      if (
        !matches(v.getLocale(), language) || v.isNetworkConnectionRequired()
      ) continue;
      boolean pending =
        v.getFeatures() != null &&
        v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
      int rank =
        (pending ? 0 : 10000) +
        (v.getLocale().getCountry().equals(locale(language).getCountry())
            ? 1000
            : 0) +
        v.getQuality();
      if (rank > score) {
        best = v;
        score = rank;
      }
    }
    return best;
  }

  boolean selectOffline(String language) throws Exception {
    if (!ttsReady) throw new Exception(
      "语音引擎尚未就绪，请在语音包管理中重新检测"
    );
    Voice selected = voice(language);
    if (
      selected != null && tts.setVoice(selected) == TextToSpeech.SUCCESS
    ) return true;
    int result = tts.setLanguage(locale(language));
    if (result == TextToSpeech.LANG_MISSING_DATA) throw new Exception(
      "系统引擎报告缺少此语言数据，请打开系统语音设置核对"
    );
    if (result < 0) throw new Exception("当前语音引擎不支持所选语言");
    Voice current = tts.getVoice();
    if (current != null) return (
      matches(current.getLocale(), language) &&
      !current.isNetworkConnectionRequired()
    );
    Set<String> features = tts.getFeatures(locale(language));
    // Legacy Samsung SMT can expose a working setLanguage implementation without a Voice list.
    // Explicitly request embedded synthesis; never accept a voice declared network-only.
    return (
      (features != null &&
        features.contains(
          TextToSpeech.Engine.KEY_FEATURE_EMBEDDED_SYNTHESIS
        )) ||
      "com.samsung.SMT".equals(tts.getDefaultEngine())
    );
  }

  String languageState(String language) {
    if (!ttsReady) return "引擎未就绪";
    if (voice(language) != null) return "本地声音候选 · 请试听验证";
    int a = availability(language);
    if (a >= 0) return "系统支持此语言 · 请试听验证";
    if (a == TextToSpeech.LANG_MISSING_DATA) return "引擎报告缺少语言数据";
    if (a == TextToSpeech.LANG_NOT_SUPPORTED) return "引擎不支持此语言";
    return "未能确定 · 请重新检测";
  }

  JSONObject status() throws Exception {
    return new JSONObject()
      .put("asr", "SenseVoice · 内置中英文离线识别")
      .put("zh", voice("zh-CN") != null || availability("zh-CN") >= 0)
      .put("en", voice("en-US") != null || availability("en-US") >= 0)
      .put("zhStatus", languageState("zh-CN"))
      .put("enStatus", languageState("en-US"))
      .put("ready", ttsReady)
      .put("platform", "android")
      .put("engine", tts == null ? "" : tts.getDefaultEngine())
      .put(
        "guide",
        "声音列表与系统语言支持分别检测。请试听确认；Samsung SMT 未列出声音时使用系统语言接口。可在飞行模式下试听验证离线播放。"
      );
  }

  void listen(String id, String language) {
    if (processing) {
      h.reply(id, null, new Exception("本地识别正在收尾，请稍后再试"));
      return;
    }
    if (
      capturing || waitingId != null || speakId != null || h.recorder != null
    ) {
      h.reply(id, null, new Exception("请先停止当前录音或朗读"));
      return;
    }
    if (
      h.checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      waitingId = id;
      waitingLanguage = language;
      h.requestPermissions(
        new String[] { Manifest.permission.RECORD_AUDIO },
        92
      );
      return;
    }
    cancel();
    asrId = id;
    final int g = generation;
    capturing = true;
    processing = true;
    final String lang = language.startsWith("en") ? "en" : "zh";
    audio.execute(() -> {
      AudioRecord record = null;
      OfflineRecognizer recognizer = null;
      OfflineStream stream = null;
      try {
        int min = AudioRecord.getMinBufferSize(
          16000,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT
        );
        record = new AudioRecord(
          MediaRecorder.AudioSource.VOICE_RECOGNITION,
          16000,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT,
          Math.max(min, 6400)
        );
        mic = record;
        if (
          record.getState() != AudioRecord.STATE_INITIALIZED
        ) throw new Exception("麦克风无法启动");
        short[] chunk = new short[1600];
        float[] samples = new float[16000 * 20];
        int count = 0;
        record.startRecording();
        while (capturing && g == generation && count < samples.length) {
          int n = record.read(
            chunk,
            0,
            Math.min(chunk.length, samples.length - count)
          );
          if (n < 0) throw new Exception("麦克风读取失败");
          for (int i = 0; i < n; i++) samples[count++] = chunk[i] / 32768f;
        }
        record.stop();
        record.release();
        record = null;
        mic = null;
        capturing = false;
        if (g != generation) return;
        if (count < 3200) throw new Exception("录音太短，请再说一次");
        OfflineSenseVoiceModelConfig sense = new OfflineSenseVoiceModelConfig();
        sense.setModel("voice/asr/model.int8.onnx");
        sense.setLanguage(lang);
        sense.setUseInverseTextNormalization(true);
        OfflineModelConfig model = new OfflineModelConfig();
        model.setSenseVoice(sense);
        model.setTokens("voice/asr/tokens.txt");
        model.setNumThreads(2);
        model.setDebug(false);
        OfflineRecognizerConfig config = new OfflineRecognizerConfig();
        config.setModelConfig(model);
        recognizer = new OfflineRecognizer(h.getAssets(), config);
        stream = recognizer.createStream();
        stream.acceptWaveform(Arrays.copyOf(samples, count), 16000);
        recognizer.decode(stream);
        String text = recognizer.getResult(stream).getText().trim();
        Arrays.fill(samples, 0);
        if (g != generation) return;
        if (text.isEmpty()) throw new Exception(
          "没有听清楚，可以重说或输入文字"
        );
        asrId = null;
        h.reply(
          id,
          new JSONObject().put("text", text).put("local", true),
          null
        );
      } catch (Throwable e) {
        if (g == generation) {
          asrId = null;
          h.reply(
            id,
            null,
            new Exception(
              "本地识别未完成：" +
              (e.getMessage() == null
                  ? e.getClass().getSimpleName()
                  : e.getMessage())
            )
          );
        }
      } finally {
        capturing = false;
        if (record != null) {
          try {
            record.stop();
          } catch (Exception ignored) {}
          record.release();
        }
        mic = null;
        if (stream != null) stream.release();
        if (recognizer != null) recognizer.release();
        processing = false;
      }
    });
  }

  void permission(boolean granted) {
    String id = waitingId;
    waitingId = null;
    if (id == null) return;
    if (granted && h.unlocked) listen(id, waitingLanguage);
    else h.reply(id, null, new Exception("未开启麦克风，可改用文字聊天"));
  }

  void stop() {
    capturing = false;
    if (waitingId != null) {
      String id = waitingId;
      waitingId = null;
      h.reply(id, null, new Exception("授权后请重新按住说话"));
    }
  }

  void speak(String id, JSONObject args) {
    try {
      if (capturing || h.recorder != null) throw new Exception(
        "录音中，请先停止录音"
      );
      cancel();
      if (
        !selectOffline(args.optString("language", "zh-CN"))
      ) throw new Exception(
        "当前声音仅支持网络或无法确认离线能力，请在系统语音设置选择离线声音"
      );
      String text = args.optString("text");
      if (text.isEmpty() || text.length() > 500) throw new Exception(
        "朗读文字长度无效"
      );
      speakId = id;
      speakTurn = args.getString("turn");
      speechFile = File.createTempFile("pet-speech-", ".wav", h.getCacheDir());
      tts.setSpeechRate(.94f);
      tts.setPitch(1.1f);
      if (
        tts.synthesizeToFile(text, offlineParams(), speechFile, speakTurn) ==
        TextToSpeech.ERROR
      ) throw new Exception("本地语音合成启动失败");
    } catch (Exception e) {
      if (speakId != null) finishSpeech(e);
      else h.reply(id, null, e);
    }
  }

  Bundle offlineParams() {
    Bundle b = new Bundle();
    b.putString(TextToSpeech.Engine.KEY_FEATURE_EMBEDDED_SYNTHESIS, "true");
    b.putString(TextToSpeech.Engine.KEY_FEATURE_NETWORK_SYNTHESIS, "false");
    return b;
  }

  void event(String turn, boolean active, double level) {
    try {
      JSONObject e = new JSONObject()
        .put("turn", turn)
        .put("active", active)
        .put("level", level);
      h.main.post(() -> {
        if (h.unlocked && h.web != null) h.web.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('pet-voice',{detail:" +
          e.toString() +
          "}))",
          null
        );
      });
    } catch (Exception ignored) {}
  }

  void playFile(File file, String turn, int g) {
    AudioTrack track = null;
    try {
      byte[] wav = MainActivity.read(new FileInputStream(file), 20000000);
      ByteBuffer b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
      if (
        wav.length < 44 ||
        b.getInt(0) != 0x46464952 ||
        b.getInt(8) != 0x45564157
      ) throw new Exception("本地声音格式不受支持");
      int channels = 1,
        rate = 22050,
        bits = 16,
        encoding = 1,
        data = 0,
        length = 0;
      for (int at = 12; at + 8 <= wav.length; ) {
        int id = b.getInt(at),
          n = b.getInt(at + 4);
        if (n < 0 || at + 8L + n > wav.length) throw new Exception(
          "本地声音数据无效"
        );
        if (id == 0x20746d66 && n >= 16) {
          encoding = b.getShort(at + 8);
          channels = b.getShort(at + 10);
          rate = b.getInt(at + 12);
          bits = b.getShort(at + 22);
        }
        if (id == 0x61746164) {
          data = at + 8;
          length = n;
          break;
        }
        at += 8 + n + (n % 2);
      }
      if (
        encoding != 1 ||
        bits != 16 ||
        channels < 1 ||
        channels > 2 ||
        length == 0
      ) throw new Exception("需要 PCM 16 位离线声音");
      if (g != generation) return;
      final AudioManager manager = (AudioManager) h.getSystemService(
        Context.AUDIO_SERVICE
      );
      AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build();
      focus = new AudioFocusRequest.Builder(
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
      )
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener(
          change -> {
            if (change < 0) h.main.post(this::cancel);
          },
          h.main
        )
        .build();
      if (
        manager.requestAudioFocus(focus) !=
        AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      ) throw new Exception("当前无法播放声音");
      int channel = channels == 1
          ? AudioFormat.CHANNEL_OUT_MONO
          : AudioFormat.CHANNEL_OUT_STEREO,
        buffer = Math.max(
          AudioTrack.getMinBufferSize(
            rate,
            channel,
            AudioFormat.ENCODING_PCM_16BIT
          ),
          (rate * channels) / 5
        );
      track = new AudioTrack(
        attributes,
        new AudioFormat.Builder()
          .setSampleRate(rate)
          .setChannelMask(channel)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .build(),
        buffer,
        AudioTrack.MODE_STREAM,
        AudioManager.AUDIO_SESSION_ID_GENERATE
      );
      player = track;
      track.play();
      int step = (rate / 25) * channels * 2,
        written = 0;
      for (int at = data; at < data + length && g == generation; ) {
        int n = Math.min(step, data + length - at);
        long sum = 0;
        for (int i = at; i + 1 < at + n; i += 2) {
          int a = b.getShort(i);
          sum += (long) a * a;
        }
        double rms = Math.sqrt(sum / (double) Math.max(1, n / 2)) / 32768.0;
        int done = track.write(wav, at, n, AudioTrack.WRITE_BLOCKING);
        if (done <= 0) throw new Exception("声音播放中断");
        at += done;
        written += done;
        event(turn, true, Math.min(1, rms * 8));
      }
      long limit = SystemClock.elapsedRealtime() + 2000;
      while (
        g == generation &&
        track.getPlaybackHeadPosition() < written / (channels * 2) &&
        SystemClock.elapsedRealtime() < limit
      ) Thread.sleep(30);
      event(turn, false, 0);
      h.main.post(() -> {
        if (g == generation) finishSpeech(null);
      });
    } catch (Exception e) {
      h.main.post(() -> {
        if (g == generation) finishSpeech(e);
      });
    } finally {
      if (track != null) {
        try {
          track.stop();
        } catch (Exception ignored) {}
        track.release();
      }
      player = null;
      file.delete();
      if (focus != null) ((AudioManager) h.getSystemService(
          Context.AUDIO_SERVICE
        )).abandonAudioFocusRequest(focus);
    }
  }

  void finishSpeech(Exception error) {
    String id = speakId,
      turn = speakTurn;
    speakId = null;
    speakTurn = null;
    if (turn != null) event(turn, false, 0);
    if (id != null) h.reply(id, new JSONObject(), error);
    if (speechFile != null) {
      speechFile.delete();
      speechFile = null;
    }
  }

  void cancel() {
    generation++;
    capturing = false;
    String id = asrId;
    asrId = null;
    if (id != null) h.reply(id, null, new Exception("录音已取消"));
    String permission = waitingId;
    waitingId = null;
    if (permission != null) h.reply(
      permission,
      null,
      new Exception("录音已取消")
    );
    if (tts != null) tts.stop();
    AudioTrack t = player;
    if (t != null) try {
      t.pause();
      t.flush();
    } catch (Exception ignored) {}
    finishSpeech(new Exception("朗读已停止"));
  }

  void destroy() {
    cancel();
    tts.shutdown();
    audio.shutdown();
  }
}
