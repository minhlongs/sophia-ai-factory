import { Polar } from "@polar-sh/sdk";

let _polar: Polar | null = null;

export function getPolar(): Polar {
  if (!_polar) {
    const accessToken = (process.env.POLAR_ACCESS_TOKEN || '').replace(/\\n$/, '').trim();
    if (!accessToken) {
      throw new Error('POLAR_ACCESS_TOKEN must be set');
    }
    _polar = new Polar({
      accessToken,
      server: process.env.NODE_ENV === "development" ? "sandbox" : "production",
    });
  }
  return _polar;
}

export const polar: Polar = new Proxy({} as Polar, {
  get(_target, prop, receiver) {
    return Reflect.get(getPolar(), prop, receiver);
  },
});
