/* Encodeur ESC/POS minimal pour imprimantes thermiques 58 mm (32 colonnes) ou 80 mm (48 colonnes).
   Les accents sont envoyés en page de code CP858 (Europe de l'Ouest + €), supportée par la plupart des modèles. */

const ESC = 0x1b;
const GS = 0x1d;

/* Correspondance Unicode -> CP858 pour les caractères français courants. */
const CP858: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89,
  'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f, 'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93,
  'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, '£': 0x9c, 'á': 0xa0, 'í': 0xa1,
  'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, '°': 0xf8, 'Â': 0xb6, 'À': 0xb7, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4,
  '€': 0xd5, 'Î': 0xd7, 'Ï': 0xd8, 'Ô': 0xe2, 'Ù': 0xeb, 'Û': 0xea, 'œ': 0x6f, 'Œ': 0x4f,
};

export function encodeText(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.normalize('NFC')) {
    const c = ch.codePointAt(0) || 0x3f;
    if (c >= 0x20 && c < 0x7f) out.push(c);
    else if (ch === '\n') out.push(0x0a);
    else if (ch === ' ' || ch === ' ') out.push(0x20);
    else if (CP858[ch] != null) out.push(CP858[ch]);
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out.push(base && base.charCodeAt(0) < 0x7f ? base.charCodeAt(0) : 0x3f);
    }
  }
  return out;
}

export class Receipt {
  bytes: number[] = [];
  /* Copie texte du ticket, pour l'aperçu à l'écran quand aucune imprimante n'est reliée. */
  preview: string[] = [];
  private al: 'left' | 'center' | 'right' = 'left';
  constructor(public cols: number) {
    this.bytes.push(ESC, 0x40); // initialisation
    this.bytes.push(ESC, 0x74, 19); // page de code CP858
  }
  align(a: 'left' | 'center' | 'right') {
    this.al = a;
    this.bytes.push(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2);
    return this;
  }
  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }
  big(on: boolean) {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }
  line(s = '') {
    this.bytes.push(...encodeText(s), 0x0a);
    const pad = Math.max(0, this.cols - s.length);
    this.preview.push(this.al === 'center' ? ' '.repeat(Math.floor(pad / 2)) + s : this.al === 'right' ? ' '.repeat(pad) + s : s);
    return this;
  }
  /* Texte à gauche, montant à droite, sur la largeur du ticket (coupe le texte s'il est trop long). */
  lr(left: string, right: string, cols = this.cols) {
    const room = Math.max(1, cols - right.length - 1);
    const l = left.length > room ? left.slice(0, room) : left;
    return this.line(l + ' '.repeat(Math.max(1, cols - l.length - right.length)) + right);
  }
  rule(ch = '-') {
    return this.line(ch.repeat(this.cols));
  }
  feed(n = 3) {
    this.bytes.push(ESC, 0x64, n);
    for (let i = 0; i < n; i++) this.preview.push('');
    return this;
  }
  cut() {
    this.bytes.push(GS, 0x56, 0x42, 0x00); // coupe partielle (ignorée par les modèles sans massicot)
    return this;
  }
  toUint8() {
    return Uint8Array.from(this.bytes);
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 3) {
    const a = u[i], b = u[i + 1], c = u[i + 2];
    s += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    s += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    s += c === undefined ? '=' : B64[c & 63];
  }
  return s;
}
