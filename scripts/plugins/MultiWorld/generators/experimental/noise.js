/**
 * 3D Perlin Noise & Multi-Noise Engine for Experimental 1.16.220 Generator
 */

export class PerlinNoise3D {
  constructor(seed = 0) {
    this.p = new Int32Array(512);
    this._initPermutation(seed);
  }

  _initPermutation(seed) {
    let x = (seed | 0) || 123456789;
    const rand = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) % 0xFFFFFFFF) / 0xFFFFFFFF;
    };
    const p256 = new Int32Array(256);
    for (let i = 0; i < 256; i++) p256[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p256[i];
      p256[i] = p256[j];
      p256[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = p256[i & 255];
    }
  }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z) {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);

    const X = fx & 255;
    const Y = fy & 255;
    const Z = fz & 255;

    x -= fx;
    y -= fy;
    z -= fz;

    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);

    const p = this.p;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

    const g000 = this.grad(p[AA], x, y, z);
    const g100 = this.grad(p[BA], x - 1, y, z);
    const g010 = this.grad(p[AB], x, y - 1, z);
    const g110 = this.grad(p[BB], x - 1, y - 1, z);
    const g001 = this.grad(p[AA + 1], x, y, z - 1);
    const g101 = this.grad(p[BA + 1], x - 1, y, z - 1);
    const g011 = this.grad(p[AB + 1], x, y - 1, z - 1);
    const g111 = this.grad(p[BB + 1], x - 1, y - 1, z - 1);

    const i00 = g000 + u * (g100 - g000);
    const i01 = g001 + u * (g101 - g001);
    const i10 = g010 + u * (g110 - g010);
    const i11 = g011 + u * (g111 - g011);

    const i0 = i00 + v * (i10 - i00);
    const i1 = i01 + v * (i11 - i01);

    return i0 + w * (i1 - i0);
  }
}

export class OctavePerlinNoise3D {
  constructor(octaves = 4, seed = 0) {
    this.octaves = [];
    for (let i = 0; i < octaves; i++) {
      this.octaves.push(new PerlinNoise3D(seed + i * 31));
    }
  }

  getValue(x, y, z) {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxAmp = 0;
    for (let i = 0; i < this.octaves.length; i++) {
      total += this.octaves[i].noise(x * freq, y * freq, z * freq) * amp;
      maxAmp += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return total / maxAmp;
  }
}

/**
 * 3D Multi-Noise Climate Evaluator (Nether & Overworld Multi-Noise)
 * Evaluates target parameters: temperature, humidity, altitude, weirdness.
 */
export class MultiNoiseEvaluator3D {
  constructor(seed = 0) {
    this.noiseTemp = new OctavePerlinNoise3D(3, seed + 101);
    this.noiseHumidity = new OctavePerlinNoise3D(3, seed + 202);
    this.noiseAltitude = new OctavePerlinNoise3D(2, seed + 303);
    this.noiseWeirdness = new OctavePerlinNoise3D(2, seed + 404);
  }

  sample(x, y, z) {
    const temperature = this.noiseTemp.getValue(x * 0.005, y * 0.005, z * 0.005);
    const humidity = this.noiseHumidity.getValue(x * 0.005, y * 0.005, z * 0.005);
    const altitude = this.noiseAltitude.getValue(x * 0.01, y * 0.01, z * 0.01);
    const weirdness = this.noiseWeirdness.getValue(x * 0.01, y * 0.01, z * 0.01);
    return { temperature, humidity, altitude, weirdness };
  }
}
