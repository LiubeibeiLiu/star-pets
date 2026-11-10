package app.starpets.local;

import android.app.*;
import android.content.*;
import android.os.Build;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.json.*;

public class Reminders extends BroadcastReceiver {

  static final String CHANNEL = "star-pets-habits";

  public void onReceive(Context context, Intent intent) {
    try {
      Store store = new Store(context);
      JSONObject state = store.read();
      if (state == null) return;
      String key = intent.getStringExtra("key"),
        label = intent.getStringExtra("label");
      String saved = context
        .getSharedPreferences("reminders", 0)
        .getString("last", "");
      if (key != null && !key.equals(saved)) {
        context
          .getSharedPreferences("reminders", 0)
          .edit()
          .putString("last", key)
          .apply();
        NotificationManager n = context.getSystemService(
          NotificationManager.class
        );
        n.createNotificationChannel(
          new NotificationChannel(
            CHANNEL,
            "习惯与伙伴提醒",
            NotificationManager.IMPORTANCE_DEFAULT
          )
        );
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent click = PendingIntent.getActivity(
          context,
          0,
          open,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification note = new Notification.Builder(context, CHANNEL)
          .setSmallIcon(android.R.drawable.btn_star_big_on)
          .setContentTitle("星星宠物")
          .setContentText(label == null ? "和伙伴一起记录今天的小进步" : label)
          .setContentIntent(click)
          .setAutoCancel(true)
          .build();
        n.notify(11, note);
      }
      store.close();
    } catch (Exception ignored) {}
    schedule(context);
  }

  static void schedule(Context c) {
    try {
      Store db = new Store(c);
      JSONObject s = db.read();
      db.close();
      AlarmManager am = c.getSystemService(AlarmManager.class);
      Intent base = new Intent(c, Reminders.class);
      PendingIntent cancel = PendingIntent.getBroadcast(
        c,
        1,
        base,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
      );
      am.cancel(cancel);
      if (s == null) return;
      JSONObject settings = s.getJSONObject("settings");
      if (!settings.optBoolean("habits", true)) return;
      JSONArray habits = s.getJSONArray("habits"),
        events = s.getJSONArray("events");
      long now = System.currentTimeMillis(),
        next = Long.MAX_VALUE;
      String label = "",
        key = "";
      LocalDate today = LocalDate.now();
      ZoneId zone = ZoneId.systemDefault();
      Set<String> reversed = new HashSet<>();
      for (int e = 0; e < events.length(); e++) {
        JSONObject row = events.getJSONObject(e);
        if (row.optString("kind").equals("reverse")) reversed.add(
          row.optString("ref")
        );
      }
      for (int h = 0; h < habits.length(); h++) {
        JSONObject habit = habits.getJSONObject(h);
        if (
          !habit.optBoolean("remind") ||
          !habit.optString("status").equals("active")
        ) continue;
        String start = habit.getString("start"),
          end = habit.optString("end"),
          frequency = habit.getString("frequency");
        JSONArray times = habit.optJSONArray("times");
        if (times == null || times.length() == 0) times = new JSONArray().put(
          "19:00"
        );
        for (int d = 0; d < 9; d++) {
          LocalDate date = today.plusDays(d);
          String day = date.toString();
          if (
            day.compareTo(start) < 0 ||
            (!end.isEmpty() && day.compareTo(end) > 0)
          ) continue;
          if (frequency.equals("days")) {
            boolean found = false;
            JSONArray days = habit.getJSONArray("days");
            for (int j = 0; j < days.length(); j++) if (
              days.getInt(j) == date.getDayOfWeek().getValue() % 7
            ) found = true;
            if (!found) continue;
          }
          if (
            frequency.equals("interval") &&
            ChronoUnit.DAYS.between(LocalDate.parse(start), date) %
            habit.getInt("interval") !=
            0
          ) continue;
          String period = frequency.equals("weekly")
            ? date.minusDays(date.getDayOfWeek().getValue() - 1).toString()
            : day;
          int count = 0;
          for (int e = 0; e < events.length(); e++) {
            JSONObject row = events.getJSONObject(e);
            if (
              row.optString("kind").equals("plus") &&
              row.optString("habitId").equals(habit.getString("id")) &&
              (frequency.equals("weekly")
                  ? LocalDate.parse(row.getString("day"))
                    .minusDays(
                      LocalDate.parse(row.getString("day"))
                        .getDayOfWeek()
                        .getValue() -
                      1
                    )
                    .toString()
                  : row.optString("day")).equals(period) &&
              !reversed.contains(row.optString("id"))
            ) count++;
          }
          if (count >= habit.getInt("target")) continue;
          for (int j = 0; j < times.length(); j++) {
            LocalTime time = LocalTime.parse(times.getString(j));
            int hr = time.getHour(),
              qs = settings.optInt("quietStart", 21),
              qe = settings.optInt("quietEnd", 7);
            if (
              qs != qe &&
              (qs > qe ? (hr >= qs || hr < qe) : (hr >= qs && hr < qe))
            ) continue;
            long at = date.atTime(time).atZone(zone).toInstant().toEpochMilli();
            if (at > now + 1000 && at < next) {
              next = at;
              label = "小挑战：" + habit.getString("name");
              key = habit.getString("id") + "/" + at;
            }
          }
        }
      }
      if (next < Long.MAX_VALUE) {
        Intent i = new Intent(c, Reminders.class)
          .putExtra("label", label)
          .putExtra("key", key);
        PendingIntent p = PendingIntent.getBroadcast(
          c,
          1,
          i,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, p);
      }
    } catch (Exception e) {
      android.util.Log.w("StarPets", "Reminder scheduling skipped", e);
    }
  }
}
