package com.musicplayer.power

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.view.WindowManager

/**
 * Keep awake: que el equipo no se duerma mientras se usa la app.
 *  - Pantalla: mientras la app está en uso la pantalla nunca se apaga. No se
 *    apaga ni se oscurece sola (FLAG_KEEP_SCREEN_ON) y, si se apaga con Power
 *    (que Android no deja bloquear), ScreenOnGuard la vuelve a encender. La
 *    app se muestra encima de la pantalla de bloqueo, así al encenderse se ve
 *    la app y no el bloqueo (que se apagaría solo).
 *  - Reproducción: mientras suena música, el procesador no se duerme aunque se
 *    apague la pantalla (p. ej. fuera de la app): la música no se corta. Lo
 *    pide JS según el estado del reproductor (PlaybackKeepAwake) y lo suelta
 *    en pausa.
 */
object KeepAwake {
  private const val PLAYBACK_TAG = "MusicaUSB:reproduccion"
  private const val SCREEN_TAG = "MusicaUSB:pantalla"

  /** Cuánto se sostiene la pantalla al volver a encenderla; después la mantiene la app. */
  private const val WAKE_SCREEN_MS = 5_000L

  private var playbackLock: PowerManager.WakeLock? = null

  fun keepScreenOn(activity: Activity) {
    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(true)
    } else {
      @Suppress("DEPRECATION")
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
    }
  }

  fun isScreenOn(context: Context): Boolean = powerManager(context).isInteractive

  /**
   * Vuelve a encender la pantalla, por dos vías porque cada Android/marca
   * restringe alguna:
   *  - un wake lock que la enciende (en Android 14+ usa el permiso "Encender la
   *    pantalla", TURN_SCREEN_ON);
   *  - ScreenOnActivity, que la enciende al mostrarse (con la pantalla apagada
   *    Android la deja abrirse gracias a "Mostrar sobre otras apps", el mismo
   *    permiso de la apertura automática).
   */
  @Suppress("DEPRECATION")
  fun wakeScreen(activity: Activity) {
    powerManager(activity)
        .newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
            SCREEN_TAG)
        .acquire(WAKE_SCREEN_MS)
    try {
      activity.startActivity(
          Intent(activity, ScreenOnActivity::class.java)
              .addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_NO_USER_ACTION))
    } catch (_: RuntimeException) {}
  }

  // Sin tiempo límite a propósito (como el wake mode de ExoPlayer): se suelta
  // al pausar o detener, y Android lo libera solo si el proceso termina.
  @SuppressLint("WakelockTimeout")
  @Synchronized
  fun setPlaybackAwake(context: Context, awake: Boolean) {
    val lock = playbackLock ?: newPlaybackLock(context).also { playbackLock = it }
    if (awake && !lock.isHeld) {
      lock.acquire()
    } else if (!awake && lock.isHeld) {
      lock.release()
    }
  }

  private fun newPlaybackLock(context: Context): PowerManager.WakeLock =
      powerManager(context).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, PLAYBACK_TAG).apply {
        setReferenceCounted(false)
      }

  private fun powerManager(context: Context): PowerManager =
      context.applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
}
