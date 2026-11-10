package app.starpets.local;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;

public class CaptureProvider extends ContentProvider {

  public boolean onCreate() {
    return true;
  }

  public String getType(Uri u) {
    return "image/jpeg";
  }

  public ParcelFileDescriptor openFile(Uri u, String mode)
    throws FileNotFoundException {
    String n = u.getLastPathSegment();
    if (
      n == null || !n.matches("[a-f0-9-]+\\.jpg")
    ) throw new FileNotFoundException();
    File f = new File(getContext().getCacheDir(), n);
    if (!f.exists()) throw new FileNotFoundException();
    return ParcelFileDescriptor.open(f, ParcelFileDescriptor.parseMode(mode));
  }

  public Cursor query(Uri u, String[] p, String s, String[] a, String so) {
    String n = u.getLastPathSegment();
    if (n == null || !n.matches("[a-f0-9-]+\\.jpg")) return null;
    File f = new File(getContext().getCacheDir(), n);
    String[] columns = p == null
      ? new String[] { "_display_name", "_size" }
      : p;
    android.database.MatrixCursor c = new android.database.MatrixCursor(
      columns
    );
    Object[] values = new Object[columns.length];
    for (int i = 0; i < columns.length; i++) values[i] = columns[i].equals(
        "_display_name"
      )
      ? n
      : columns[i].equals("_size") ? f.length() : null;
    c.addRow(values);
    return c;
  }

  public Uri insert(Uri u, ContentValues v) {
    throw new UnsupportedOperationException();
  }

  public int delete(Uri u, String s, String[] a) {
    return 0;
  }

  public int update(Uri u, ContentValues v, String s, String[] a) {
    return 0;
  }
}
