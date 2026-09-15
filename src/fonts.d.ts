// src/fonts.d.ts
// Tipo del modulo virtuale servito dal plugin tdv-font-base64 (vite.config.ts):
// `font:<nome>` restituisce la stringa base64 di src/lib/server/fonts/<nome>.ttf.
//
// Sta in un file suo e non in app.d.ts perché quello contiene `export {}`, che
// lo rende un modulo: lì dentro `declare module` sarebbe un'augmentation di un
// modulo inesistente invece di una dichiarazione ambientale, e il tipo non
// verrebbe trovato. Questo file non ha import né export proprio per restare
// ambientale.

declare module 'font:*' {
  const base64: string;
  export default base64;
}
