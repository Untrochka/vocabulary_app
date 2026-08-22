import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Официальная палитра Duolingo (design.duolingo.com/identity/color):
        // Feather Green как основной цвет бренда, вторичные цвета по
        // назначению (Macaw — ссылки/инфо, Cardinal — ошибка, Bee — награды,
        // Fox — стрик, Beetle — акцент), нейтрали от Eel до Snow.
        feather: "#58CC02",
        featherDark: "#58A700",
        mask: "#89E219",
        macaw: "#1CB0F6",
        macawDark: "#1899D6",
        humpback: "#2B70C9",
        cardinal: "#FF4B4B",
        cardinalDark: "#EA2B2B",
        bee: "#FFC800",
        beeDark: "#E5B400",
        fox: "#FF9600",
        foxDark: "#E08600",
        beetle: "#CE82FF",
        beetleDark: "#A568CC",
        eel: "#4B4B4B",
        wolf: "#777777",
        hare: "#AFAFAF",
        swan: "#E5E5E5",
        polar: "#F7F7F7",
        snow: "#FFFFFF",
      },
      fontFamily: {
        // Duolingo использует проприетарные Feather Bold (заголовки) и DIN
        // Next Rounded (интерфейс) — оба лицензируются отдельно. Nunito —
        // ближайший бесплатный аналог с тем же скруглённым, дружелюбным
        // рисунком букв, широко используемый как замена в клонах их UI.
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "20px", lg2: "16px", md2: "12px", sm2: "8px" },
      boxShadow: {
        card: "0 2px 0 0 #E5E5E5",
      },
    },
  },
  plugins: [],
};
export default config;
