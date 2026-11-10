package app.starpets.local;

import android.content.*;
import android.database.*;
import android.database.sqlite.*;
import org.json.*;

final class Store extends SQLiteOpenHelper {

  Store(Context c) {
    super(c, "star-pets.db", null, 1);
  }

  public void onCreate(SQLiteDatabase d) {
    d.execSQL(
      "CREATE TABLE document (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL)"
    );
    d.execSQL(
      "CREATE TABLE checkpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, body TEXT)"
    );
  }

  public void onUpgrade(SQLiteDatabase d, int a, int b) {
    throw new IllegalStateException("Unsupported schema migration");
  }

  synchronized JSONObject read() throws Exception {
    try (
      Cursor c = getReadableDatabase().rawQuery(
        "SELECT body FROM document WHERE id=1",
        null
      )
    ) {
      return c.moveToFirst() ? new JSONObject(c.getString(0)) : null;
    }
  }

  synchronized JSONObject checkpoint() throws Exception {
    try (
      Cursor c = getReadableDatabase().rawQuery(
        "SELECT body FROM checkpoints ORDER BY id DESC LIMIT 1",
        null
      )
    ) {
      if (!c.moveToFirst()) throw new Exception("还没有还原前检查点");
      return new JSONObject(c.getString(0));
    }
  }

  synchronized void save(JSONObject body, int expected, boolean restore)
    throws Exception {
    validate(body);
    SQLiteDatabase d = getWritableDatabase();
    d.beginTransaction();
    try {
      JSONObject old = read();
      int rev = old == null ? 0 : old.getInt("revision");
      if (rev != expected) throw new Exception("数据已更新，请重新打开页面");
      if (body.getInt("revision") != rev + 1) throw new Exception(
        "数据版本不连续"
      );
      if (restore && old != null) {
        ContentValues b = new ContentValues();
        b.put("created", System.currentTimeMillis());
        b.put("body", old.toString());
        d.insertOrThrow("checkpoints", null, b);
      }
      ContentValues v = new ContentValues();
      v.put("id", 1);
      v.put("revision", body.getInt("revision"));
      v.put("body", body.toString());
      d.insertWithOnConflict(
        "document",
        null,
        v,
        SQLiteDatabase.CONFLICT_REPLACE
      );
      d.setTransactionSuccessful();
    } finally {
      d.endTransaction();
    }
  }

  static void validate(JSONObject j) throws Exception {
    if (
      j.getInt("schema") != 1 || j.getInt("revision") < 0
    ) throw new Exception("不兼容的数据版本");
    for (String k : new String[] {
      "pets",
      "events",
      "habits",
      "memories",
      "imports",
      "rules",
    })
      j.getJSONArray(k);
    j.getJSONObject("settings");
    j.getJSONObject("care");
    if (
      j.getJSONArray("events").length() > 100000 ||
      j.toString().length() > 32000000
    ) throw new Exception("数据超过容量限制");
  }
}
