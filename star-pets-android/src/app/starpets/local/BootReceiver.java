package app.starpets.local;

import android.content.*;

public class BootReceiver extends BroadcastReceiver {

  public void onReceive(Context c, Intent i) {
    Reminders.schedule(c);
  }
}
