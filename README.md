# Música USB 🎵🔌

Reproductor de música **Android** (React Native) para **pendrives conectados al celular por USB OTG**. Pensado para usarse casi sin tocar la pantalla: al enchufar el pendrive la app se abre y **empieza a reproducir sola**, muestra el tema actual con **letras muy grandes**, la lista de próximas canciones de la carpeta, y se maneja completo con un **control remoto Bluetooth**.

## 📥 Descargar el APK

Compilado automáticamente en cada push por GitHub Actions y publicado en la rama [`apk-dist`](../../tree/apk-dist):

| Archivo | Para qué celular | Tamaño |
|---|---|---|
| **[MusicaUSB-arm64.apk](../../raw/apk-dist/MusicaUSB-arm64.apk)** ⭐ | Cualquier celular de ~2017 en adelante (64 bits) | ~7,5 MB |
| [MusicaUSB-arm32.apk](../../raw/apk-dist/MusicaUSB-arm32.apk) | Celulares viejos de 32 bits | ~7 MB |
| [MusicaUSB-universal.apk](../../raw/apk-dist/MusicaUSB-universal.apk) | Cualquiera (incluye emuladores x86) | ~18 MB |

Checksums en [`SHA256SUMS.txt`](../../raw/apk-dist/SHA256SUMS.txt). También quedan como artefacto de cada ejecución en [Actions](../../actions). Instalación: abrir el APK en el celular y permitir *"instalar apps de origen desconocido"* (firma de prueba, app de uso personal).

## Qué hace

- **Arranque automático**: al conectar un pendrive, Android ofrece abrir "Música USB" (si marcas *"Usar de forma predeterminada"*, se abre sola cada vez). Ya abierta, detecta el montaje del pendrive, lo escanea y **reproduce inmediatamente**.
- **Orden de reproducción**:
  1. Si hay archivos de audio **en la raíz** del pendrive, suenan primero, en **orden alfabético** por nombre de archivo (números en orden natural: `2 - tema` antes que `10 - tema`).
  2. Después siguen las **carpetas en orden alfabético**; dentro de cada carpeta, los archivos también en orden alfabético. Las subcarpetas se recorren en profundidad, justo después de su carpeta madre, también alfabéticamente.
  3. Al terminar el último tema, la cola vuelve a empezar.
- **Pantalla adaptativa**: en vertical, el tema actual arriba y la lista debajo; en horizontal, tema y controles a la izquierda y la lista a la derecha. La pantalla no se apaga mientras la app está al frente.
- **Letras muy grandes**: el nombre del archivo en reproducción ocupa el protagonismo (se auto-ajusta si el nombre es largo), con la lista de la carpeta actual en tipografía grande y alto contraste.
- **Control remoto Bluetooth**: navegación por la lista y entre carpetas con flechas + OK, play/pausa, tema anterior/siguiente, adelantar/atrasar 10 s y volumen (ver mapa de teclas abajo).
- También responde a los controles de la **notificación / pantalla de bloqueo** y a botones multimedia de auriculares y estéreos Bluetooth.
- Si un archivo está dañado o no se puede leer, salta solo al siguiente.
- Al sacar el pendrive, la música se detiene y la app queda esperando el próximo.

Formatos soportados (los que decodifica Android/ExoPlayer): `mp3, m4a, m4b, aac, wav, ogg, oga, opus, flac, amr, mka`. Se ignoran carpetas ocultas y de sistema (`Android`, `LOST.DIR`, `System Volume Information`, etc.).

## Control remoto: modelos comprables en Brasil

⚠️ **Importante**: el puerto USB-C del celular queda ocupado por el pendrive, así que el control **tiene que ser Bluetooth**. Los modelos que solo traen dongle USB de 2.4 GHz (MX3/MX3 Pro, Rii i8 vendido en Brasil) **no sirven** salvo que uses un hub OTG con dos puertos.

Investigación con listados reales en tiendas brasileñas (verificados en septiembre de 2026; precios orientativos):

| Modelo | Qué permite | Precio aprox. | Dónde |
|---|---|---|---|
| **Air Mouse G10S Pro BT** ⭐ recomendado | D-pad + OK (navegar lista y carpetas), Play/Pausa, Volumen ±, Mute | R$ 60–130 | [Mercado Livre](https://www.mercadolivre.com.br/controle-remoto-de-voz-retroiluminado-g10s-pro-bt-airmouse-s/p/MLB2027500178) · [Shopee](https://shopee.com.br/Controle-Air-Mouse-G10S-PRO-Bluetooth-i.316741577.16587246008) |
| **ELG BRC10** (marca nacional, con garantía) | Play/Pausa, anterior/siguiente, Volumen ± (sin D-pad) | R$ 62,50 | [Kalunga](https://www.kalunga.com.br/prod/controlador-de-midia-bluetooth-brc10-elg-cx-1-un/229219) · [Kabum](https://www.kabum.com.br/produto/409020/controle-remoto-bluetooth-para-celular-smartphone) · [Amazon.com.br](https://www.amazon.com.br/Controle-Remoto-M%C3%ADdia-Bluetooth-Smartphones/dp/B08YM92YNR) |
| Control de volante/manubrio Bluetooth (KX3 o genérico de 5 botones) | Play/Pausa, anterior/siguiente, Volumen ± (sin D-pad) | R$ 20–80 | [Mercado Livre](https://lista.mercadolivre.com.br/controle-volante-bluetooth) · [Shopee](https://shopee.com.br/Controle-Remoto-Sem-Fio-Bluetooth-Universal-para-Volante-de-Carro-5-Bot%C3%B5es-para-Controle-de-Volume-de-M%C3%ADdia-Android-iOS-i.230709939.56107767986) |
| Mini teclado Bluetooth (p. ej. KP-TE109) | Flechas + Enter + teclas multimedia (más aparatoso) | R$ 78 | [Kabum](https://www.kabum.com.br/produto/429062/teclado-mini-bluetooth-celular-desktop-pc-notebook-tablet-smart-tv-kp-te109-preto) |

**Recomendación**: el **G10S Pro BT** es el único de la lista que cumple todo el pedido en un solo aparato (navegar la lista y las carpetas + play + volumen + adelantar/atrasar). Al comprar, confirmá que el título/ficha diga **"BT" o "Bluetooth 5.0"**: existen muchísimos listados del mismo control solo 2.4 GHz. Como alternativa económica solo para play/pausa/saltar/volumen, el ELG BRC10 o un control de volante genérico.

Emparejamiento: Ajustes → Bluetooth del celular → vincular como dispositivo nuevo (aparece como teclado/control HID). No requiere configuración en la app.

## Mapa de teclas del control remoto

| Tecla del control | Acción en la app |
|---|---|
| ▲ / ▼ (D-pad) | Mover la selección por la lista (pasa de carpeta al llegar al borde) |
| ◀ / ▶ (D-pad) | Ver carpeta anterior / siguiente (sin cortar la música) |
| OK / Enter | Reproducir el tema seleccionado |
| Play/Pausa | Alternar reproducción |
| ⏮ / ⏭ | Tema anterior / siguiente |
| ⏪ / ⏩ | Atrasar / adelantar 10 segundos |
| Canal +/− o Re Pág/Av Pág | Saltar a la carpeta siguiente / anterior (reproduce ya) |
| Volumen +/− | Volumen del sistema (lo maneja Android directamente) |

Los botones en pantalla replican todo: `⏮ «10s ▶/⏸ 10s» ⏭`, `◀ Carpeta / Carpeta ▶` y `Vol − / Vol +`.

## Compilar e instalar

Requisitos: Node 20+, JDK 17–21, Android SDK (o Android Studio). El proyecto es **solo Android** (iOS no permite montar pendrives con arranque automático).

```bash
npm install

# Con un celular conectado por ADB (o emulador):
npm run android

# APK de release para instalar a mano:
cd android && ./gradlew assembleRelease
# queda en android/app/build/outputs/apk/release/app-release.apk
```

Chequeos rápidos: `npm test` (lógica de escaneo/orden) y `npm run typecheck`. Si solo querés instalar la app, no hace falta compilar: usá la sección [Descargar el APK](#-descargar-el-apk).

### Primer uso

1. Abrí la app: va a pedir el **permiso de archivos** ("Acceso a todos los archivos" en Android 11+, permiso de almacenamiento en versiones anteriores). Es necesario para leer el pendrive por ruta directa (`/storage/XXXX-XXXX`). En Android 13+ también pide permiso de notificaciones (controles en la pantalla de bloqueo).
2. Conectá el pendrive con un **adaptador OTG** (USB-C o micro-USB según el celular).
3. Cuando Android pregunte con qué app abrir el dispositivo USB, elegí *Música USB* y marcá *"Usar de forma predeterminada"* para el arranque automático.
4. La música empieza sola. 🎶

## Solución de problemas

- **No detecta el pendrive**: verificá que el celular soporte OTG y que esté activado (en algunos equipos: Ajustes → Sistema → OTG). Formateá el pendrive en **FAT32 o exFAT**; NTFS no está soportado por la mayoría de los Android.
- **No arranca sola al enchufar**: la primera vez hay que aceptar el diálogo de Android y marcar "usar de forma predeterminada". Si la app ya está abierta, no hace falta nada: detecta el montaje sola (escaneo + sondeo cada 4 s).
- **Empieza unos segundos después de enchufar**: es normal; Android tarda en montar el volumen.
- **El control remoto no hace nada**: confirmá que esté emparejado por Bluetooth (no con dongle), y que la app esté en primer plano para la navegación con flechas. Play/pausa/saltar funcionan incluso con la pantalla bloqueada (MediaSession).

## Estructura del código

```
android/app/src/main/java/com/musicplayer/
  MainActivity.kt          # teclas del remoto → JS; pantalla siempre encendida
  usb/UsbAudioModule.kt    # volúmenes USB, listado de archivos, permisos,
                           # volumen del sistema, broadcasts de montaje
src/
  library.ts               # escaneo del pendrive y orden alfabético (puro, testeado)
  player.ts                # cola, setup de react-native-track-player, seek
  service.ts               # servicio de reproducción (botones multimedia/Bluetooth)
  keymap.ts                # códigos de tecla Android del control remoto
  components/              # NowPlaying, FolderList, Controls, StatusScreen
App.tsx                    # estados (permiso/espera/escaneo/reproducción),
                           # navegación con remoto, layout vertical/horizontal
__tests__/library.test.ts  # tests del orden de reproducción
```

## Limitaciones conocidas

- Solo Android. En iOS no existe autoarranque por USB ni montaje libre de pendrives.
- El permiso "Acceso a todos los archivos" (`MANAGE_EXTERNAL_STORAGE`) es la vía simple y robusta para leer el pendrive por ruta; es apropiado para una app de uso personal (instalada por APK), pero Google Play lo restringe para apps publicadas.
- Pendrives NTFS: dependen del soporte del fabricante del celular; lo estándar es FAT32/exFAT.
- La app usa la arquitectura clásica de React Native (`newArchEnabled=false`) por compatibilidad con `react-native-track-player` 4.x.
