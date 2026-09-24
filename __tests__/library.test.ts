import {
  compareNames,
  DirEntry,
  fileUrl,
  flattenGroups,
  isAudioFile,
  ROOT_FOLDER_NAME,
  scanLibrary,
  scanVolume,
} from '../src/library';

/** Simula un pendrive como mapa ruta -> entradas. */
function fakeListDir(tree: Record<string, DirEntry[]>) {
  return (path: string) => Promise.resolve(tree[path] ?? []);
}

function file(dir: string, name: string): DirEntry {
  return {name, path: `${dir}/${name}`, isDirectory: false};
}

function folder(dir: string, name: string): DirEntry {
  return {name, path: `${dir}/${name}`, isDirectory: true};
}

const ROOT = '/storage/ABCD-1234';

describe('isAudioFile', () => {
  it('acepta extensiones de audio comunes sin importar mayúsculas', () => {
    expect(isAudioFile('tema.mp3')).toBe(true);
    expect(isAudioFile('TEMA.MP3')).toBe(true);
    expect(isAudioFile('tema.flac')).toBe(true);
    expect(isAudioFile('tema.m4a')).toBe(true);
    expect(isAudioFile('tema.ogg')).toBe(true);
  });

  it('rechaza lo que no es audio', () => {
    expect(isAudioFile('foto.jpg')).toBe(false);
    expect(isAudioFile('video.mp4')).toBe(false);
    expect(isAudioFile('sin_extension')).toBe(false);
    expect(isAudioFile('.mp3')).toBe(false);
  });
});

describe('compareNames', () => {
  it('ordena alfabéticamente ignorando mayúsculas y con números naturales', () => {
    const names = ['b.mp3', 'A.mp3', '10 - tema.mp3', '2 - tema.mp3'];
    expect([...names].sort(compareNames)).toEqual([
      '2 - tema.mp3',
      '10 - tema.mp3',
      'A.mp3',
      'b.mp3',
    ]);
  });
});

describe('fileUrl', () => {
  it('codifica espacios y caracteres conflictivos preservando las barras', () => {
    expect(fileUrl('/storage/AB/mi tema #1.mp3')).toBe(
      'file:///storage/AB/mi%20tema%20%231.mp3',
    );
  });
});

describe('scanVolume', () => {
  it('la música de la raíz va primero, en orden alfabético', async () => {
    const tree = {
      [ROOT]: [
        file(ROOT, 'zeta.mp3'),
        file(ROOT, 'alfa.mp3'),
        file(ROOT, 'notas.txt'),
        folder(ROOT, 'Rock'),
      ],
      [`${ROOT}/Rock`]: [file(`${ROOT}/Rock`, 'cancion.mp3')],
    };
    const groups = await scanVolume(ROOT, fakeListDir(tree));

    expect(groups[0].name).toBe(ROOT_FOLDER_NAME);
    expect(groups[0].tracks.map(t => t.title)).toEqual(['alfa', 'zeta']);
    expect(groups[1].name).toBe('Rock');
  });

  it('sin música en la raíz usa las carpetas en orden alfabético', async () => {
    const tree = {
      [ROOT]: [
        folder(ROOT, 'zamba'),
        folder(ROOT, 'Cumbia'),
        folder(ROOT, 'rock'),
        file(ROOT, 'leeme.txt'),
      ],
      [`${ROOT}/zamba`]: [file(`${ROOT}/zamba`, 'z1.mp3')],
      [`${ROOT}/Cumbia`]: [
        file(`${ROOT}/Cumbia`, 'b.mp3'),
        file(`${ROOT}/Cumbia`, 'a.mp3'),
      ],
      [`${ROOT}/rock`]: [file(`${ROOT}/rock`, 'r1.mp3')],
    };
    const groups = await scanVolume(ROOT, fakeListDir(tree));

    expect(groups.map(g => g.name)).toEqual(['Cumbia', 'rock', 'zamba']);
    expect(groups[0].tracks.map(t => t.title)).toEqual(['a', 'b']);
  });

  it('recorre subcarpetas en profundidad justo después de su carpeta madre', async () => {
    const tree = {
      [ROOT]: [folder(ROOT, 'A'), folder(ROOT, 'B')],
      [`${ROOT}/A`]: [
        file(`${ROOT}/A`, 'a1.mp3'),
        folder(`${ROOT}/A`, 'A-sub'),
      ],
      [`${ROOT}/A/A-sub`]: [file(`${ROOT}/A/A-sub`, 'sub.mp3')],
      [`${ROOT}/B`]: [file(`${ROOT}/B`, 'b1.mp3')],
    };
    const groups = await scanVolume(ROOT, fakeListDir(tree));

    expect(groups.map(g => g.name)).toEqual(['A', 'A / A-sub', 'B']);
  });

  it('ignora carpetas ocultas y de sistema', async () => {
    const tree = {
      [ROOT]: [
        folder(ROOT, '.oculta'),
        folder(ROOT, 'Android'),
        folder(ROOT, 'LOST.DIR'),
        folder(ROOT, 'System Volume Information'),
        folder(ROOT, 'Música'),
      ],
      [`${ROOT}/.oculta`]: [file(`${ROOT}/.oculta`, 'x.mp3')],
      [`${ROOT}/Android`]: [file(`${ROOT}/Android`, 'x.mp3')],
      [`${ROOT}/LOST.DIR`]: [file(`${ROOT}/LOST.DIR`, 'x.mp3')],
      [`${ROOT}/System Volume Information`]: [
        file(`${ROOT}/System Volume Information`, 'x.mp3'),
      ],
      [`${ROOT}/Música`]: [file(`${ROOT}/Música`, 'tema.mp3')],
    };
    const groups = await scanVolume(ROOT, fakeListDir(tree));

    expect(groups.map(g => g.name)).toEqual(['Música']);
  });

  it('mantiene startIndex e índices coherentes con la cola global', async () => {
    const tree = {
      [ROOT]: [file(ROOT, 'raiz.mp3'), folder(ROOT, 'Carpeta')],
      [`${ROOT}/Carpeta`]: [
        file(`${ROOT}/Carpeta`, 'c1.mp3'),
        file(`${ROOT}/Carpeta`, 'c2.mp3'),
      ],
    };
    const groups = await scanVolume(ROOT, fakeListDir(tree));
    const all = flattenGroups(groups);

    expect(groups[0].startIndex).toBe(0);
    expect(groups[1].startIndex).toBe(1);
    expect(all).toHaveLength(3);
    expect(all[1].title).toBe('c1');
    expect(all[1].folderIndex).toBe(1);
    expect(all[1].indexInFolder).toBe(0);
    expect(all[2].indexInFolder).toBe(1);
  });

  it('respeta el límite máximo de pistas', async () => {
    const many = Array.from({length: 30}, (_, i) =>
      file(ROOT, `tema-${String(i).padStart(2, '0')}.mp3`),
    );
    const groups = await scanVolume(ROOT, fakeListDir({[ROOT]: many}), {
      maxTracks: 10,
    });

    expect(flattenGroups(groups)).toHaveLength(10);
  });
});

describe('scanLibrary (árbol de carpetas para navegar)', () => {
  it('incluye TODAS las carpetas, tengan o no música, sin las ocultas ni de sistema', async () => {
    const tree = {
      [ROOT]: [
        folder(ROOT, 'Videos'),
        folder(ROOT, 'Musica'),
        folder(ROOT, 'Fotos'),
        folder(ROOT, '.oculta'),
        folder(ROOT, 'LOST.DIR'),
      ],
      [`${ROOT}/Fotos`]: [file(`${ROOT}/Fotos`, 'foto.jpg')],
      [`${ROOT}/Musica`]: [
        file(`${ROOT}/Musica`, 'b.mp3'),
        file(`${ROOT}/Musica`, 'leeme.txt'),
        file(`${ROOT}/Musica`, 'a.mp3'),
      ],
      [`${ROOT}/Videos`]: [],
    };
    const {tree: root} = await scanLibrary(ROOT, fakeListDir(tree));

    expect(root.label).toBe(ROOT_FOLDER_NAME);
    expect(root.folders.map(f => f.name)).toEqual(['Fotos', 'Musica', 'Videos']);
    expect(root.folders.map(f => f.trackCount)).toEqual([0, 2, 0]);
    // Adentro, solo lo reproducible y en orden alfabético.
    expect(root.folders[0].tracks).toEqual([]);
    expect(root.folders[1].tracks.map(t => t.title)).toEqual(['a', 'b']);
  });

  it('anida las subcarpetas y cuenta sus canciones en la carpeta madre', async () => {
    const tree = {
      [ROOT]: [folder(ROOT, 'A')],
      [`${ROOT}/A`]: [
        file(`${ROOT}/A`, 'a1.mp3'),
        folder(`${ROOT}/A`, 'A-sub'),
        folder(`${ROOT}/A`, 'A-vacia'),
      ],
      [`${ROOT}/A/A-sub`]: [file(`${ROOT}/A/A-sub`, 'sub.mp3')],
      [`${ROOT}/A/A-vacia`]: [],
    };
    const {tree: root} = await scanLibrary(ROOT, fakeListDir(tree));
    const a = root.folders[0];

    expect(a.trackCount).toBe(2);
    expect(a.folders.map(f => f.name)).toEqual(['A-sub', 'A-vacia']);
    expect(a.folders[0].label).toBe('A / A-sub');
    expect(root.trackCount).toBe(2);
  });

  it('la cola es la misma que la de scanVolume', async () => {
    const tree = {
      [ROOT]: [file(ROOT, 'raiz.mp3'), folder(ROOT, 'B'), folder(ROOT, 'A')],
      [`${ROOT}/A`]: [file(`${ROOT}/A`, 'a.mp3')],
      [`${ROOT}/B`]: [file(`${ROOT}/B`, 'b.mp3')],
    };
    const {groups} = await scanLibrary(ROOT, fakeListDir(tree));

    expect(groups).toEqual(await scanVolume(ROOT, fakeListDir(tree)));
  });
});
