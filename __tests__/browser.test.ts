/**
 * Navegador de carpetas del pendrive (reglas puras): qué se lista en cada
 * carpeta y cómo se mueven el cursor, Re Pág / Av Pág y ◀ / ▶.
 */
import {BrowseState, FolderBrowser} from '../src/core/browser/FolderBrowser';
import {DirEntry, ROOT_FOLDER_NAME, scanLibrary} from '../src/library';

const ROOT = '/usb';

function file(dir: string, name: string): DirEntry {
  return {name, path: `${dir}/${name}`, isDirectory: false};
}

function folder(dir: string, name: string): DirEntry {
  return {name, path: `${dir}/${name}`, isDirectory: true};
}

/**
 * /usb
 *   intro.mp3
 *   Fotos/        foto.jpg          (sin música)
 *   Rock/         r1.mp3 r2.mp3 r3.mp3, Clasicos/ c1.mp3, notas.txt
 *   Vacia/
 */
async function makeBrowser(): Promise<FolderBrowser> {
  const tree: Record<string, DirEntry[]> = {
    [ROOT]: [
      folder(ROOT, 'Rock'),
      file(ROOT, 'intro.mp3'),
      folder(ROOT, 'Vacia'),
      folder(ROOT, 'Fotos'),
    ],
    [`${ROOT}/Fotos`]: [file(`${ROOT}/Fotos`, 'foto.jpg')],
    [`${ROOT}/Rock`]: [
      file(`${ROOT}/Rock`, 'r2.mp3'),
      file(`${ROOT}/Rock`, 'notas.txt'),
      folder(`${ROOT}/Rock`, 'Clasicos'),
      file(`${ROOT}/Rock`, 'r1.mp3'),
      file(`${ROOT}/Rock`, 'r3.mp3'),
    ],
    [`${ROOT}/Rock/Clasicos`]: [file(`${ROOT}/Rock/Clasicos`, 'c1.mp3')],
    [`${ROOT}/Vacia`]: [],
  };
  const {tree: root} = await scanLibrary(ROOT, path =>
    Promise.resolve(tree[path] ?? []),
  );
  return new FolderBrowser(root);
}

/** Lo que se ve en la carpeta abierta: "📁 carpeta" o el título. */
function listed(browser: FolderBrowser, state: BrowseState): string[] {
  return browser
    .items(state)
    .map(item =>
      item.kind === 'folder' ? `📁 ${item.folder.name}` : item.track.title,
    );
}

const at = (dir: string, cursor = 0): BrowseState => ({dir, cursor});

describe('qué se lista', () => {
  it('primero TODAS las carpetas (tengan o no música), después las canciones', async () => {
    const browser = await makeBrowser();
    expect(browser.folderOf(browser.start()).label).toBe(ROOT_FOLDER_NAME);
    expect(listed(browser, browser.start())).toEqual([
      '📁 Fotos',
      '📁 Rock',
      '📁 Vacia',
      'intro',
    ]);
  });

  it('adentro de una carpeta solo se ven las canciones reproducibles', async () => {
    const browser = await makeBrowser();
    expect(listed(browser, at(`${ROOT}/Rock`))).toEqual([
      '📁 Clasicos',
      'r1',
      'r2',
      'r3',
    ]);
    expect(listed(browser, at(`${ROOT}/Fotos`))).toEqual([]);
  });

  it('cada carpeta sabe cuántas canciones tiene (con sus subcarpetas)', async () => {
    const browser = await makeBrowser();
    const counts = browser
      .items(browser.start())
      .map(item => (item.kind === 'folder' ? item.folder.trackCount : -1));
    expect(counts).toEqual([0, 4, 0, -1]);
  });
});

describe('Av Pág entra y Re Pág sube', () => {
  it('Av Pág entra a la carpeta resaltada, con el cursor arriba', async () => {
    const browser = await makeBrowser();
    const inRock = browser.enter(at(ROOT, 1));
    expect(inRock).toEqual(at(`${ROOT}/Rock`, 0));
    expect(browser.enter(inRock)).toEqual(at(`${ROOT}/Rock/Clasicos`, 0));
  });

  it('Av Pág sobre una canción no hace nada', async () => {
    const browser = await makeBrowser();
    const onSong = at(`${ROOT}/Rock`, 2);
    expect(browser.enter(onSong)).toBe(onSong);
  });

  it('Re Pág sube un nivel con el cursor en la carpeta de la que se salió', async () => {
    const browser = await makeBrowser();
    const inRock = browser.up(at(`${ROOT}/Rock/Clasicos`, 0));
    expect(inRock).toEqual(at(`${ROOT}/Rock`, 0));
    expect(browser.up(at(`${ROOT}/Rock`, 3))).toEqual(at(ROOT, 1));
    expect(browser.up(at(`${ROOT}/Vacia`))).toEqual(at(ROOT, 2));
  });

  it('en la raíz Re Pág no hace nada', async () => {
    const browser = await makeBrowser();
    const start = browser.start();
    expect(browser.canGoUp(start)).toBe(false);
    expect(browser.up(start)).toBe(start);
    expect(browser.canGoUp(at(`${ROOT}/Rock`))).toBe(true);
  });
});

describe('▲ / ▼', () => {
  it('mueven el cursor sin dar la vuelta en los extremos', async () => {
    const browser = await makeBrowser();
    const rock = `${ROOT}/Rock`; // Clasicos, r1, r2, r3
    expect(browser.moveCursor(at(rock, 0), 1)).toEqual(at(rock, 1));
    expect(browser.moveCursor(at(rock, 0), -1)).toEqual(at(rock, 0));
    expect(browser.moveCursor(at(rock, 3), 1)).toEqual(at(rock, 3));
  });

  it('en una carpeta vacía no hacen nada', async () => {
    const browser = await makeBrowser();
    const empty = at(`${ROOT}/Vacia`);
    expect(browser.moveCursor(empty, 1)).toBe(empty);
  });
});

describe('◀ / ▶: canción anterior / siguiente', () => {
  it('pasan a la canción vecina, salteando las carpetas', async () => {
    const browser = await makeBrowser();
    const rock = `${ROOT}/Rock`; // Clasicos, r1, r2, r3
    const next = browser.adjacentTrack(at(rock, 1), 1);
    expect(next?.state).toEqual(at(rock, 2));
    expect(next?.track.title).toBe('r2');
    expect(browser.adjacentTrack(at(rock, 2), -1)?.track.title).toBe('r1');
    // Desde la carpeta resaltada, ▶ va a la primera canción.
    expect(browser.adjacentTrack(at(rock, 0), 1)?.track.title).toBe('r1');
  });

  it('en los extremos no hacen nada (no dan la vuelta)', async () => {
    const browser = await makeBrowser();
    const rock = `${ROOT}/Rock`;
    expect(browser.adjacentTrack(at(rock, 3), 1)).toBeNull();
    expect(browser.adjacentTrack(at(rock, 1), -1)).toBeNull();
    expect(browser.adjacentTrack(at(`${ROOT}/Vacia`), 1)).toBeNull();
  });
});

describe('seguir a la canción que suena', () => {
  it('reveal abre su carpeta con ella resaltada', async () => {
    const browser = await makeBrowser();
    expect(browser.reveal(`${ROOT}/Rock/r2.mp3`)).toEqual(
      at(`${ROOT}/Rock`, 2),
    );
    expect(browser.reveal(`${ROOT}/intro.mp3`)).toEqual(at(ROOT, 3));
    expect(browser.reveal('/otra/cosa.mp3')).toBeNull();
  });

  it('selected devuelve el ítem resaltado', async () => {
    const browser = await makeBrowser();
    const item = browser.selected(at(`${ROOT}/Rock`, 3));
    expect(item?.kind === 'track' && item.track.title).toBe('r3');
    expect(browser.selected(at(`${ROOT}/Vacia`))).toBeUndefined();
  });
});
