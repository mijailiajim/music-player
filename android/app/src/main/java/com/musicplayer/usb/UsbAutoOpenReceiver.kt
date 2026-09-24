package com.musicplayer.usb

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.provider.Settings
import com.musicplayer.MainActivity

/**
 * Abre la app sola al conectar un pendrive (dispositivo USB de almacenamiento),
 * sin el diálogo "¿Abrir con…?" de Android: ese diálogo aparece cuando una
 * actividad declara USB_DEVICE_ATTACHED, así que la app ya no lo declara y la
 * abre este receptor.
 *
 * Desde Android 10 una app solo puede abrirse desde segundo plano si tiene el
 * permiso "Mostrar sobre otras apps"; la app lo pide una vez (ver
 * UsbAudioModule.requestAutoOpen).
 */
class UsbAutoOpenReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) return
    if (!isMassStorage(deviceOf(intent))) return
    if (!canOpenFromBackground(context)) return
    val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(open)
    } catch (_: Exception) {}
  }

  private fun deviceOf(intent: Intent): UsbDevice? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
      } else {
        @Suppress("DEPRECATION") intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
      }

  /** Pendrives, lectores de tarjetas y discos: alguna interfaz de clase 8. */
  private fun isMassStorage(device: UsbDevice?): Boolean {
    if (device == null) return false
    return (0 until device.interfaceCount).any {
      device.getInterface(it).interfaceClass == UsbConstants.USB_CLASS_MASS_STORAGE
    }
  }

  companion object {
    /** En Android 9 o menor no hace falta permiso para abrirse sola. */
    fun canOpenFromBackground(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(context)
  }
}
