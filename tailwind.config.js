/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./*.jsx", "./lib.js"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        ink: "#424A57",
        strong: "#252B36",
        mute: "#8A93A2",
        line: "#E8EAEE",
        canvas: "#F7F8FA",
        brand: { DEFAULT: "#387ED1", dark: "#2B67AE", soft: "#EAF2FC" },
        up: "#3E9E58",
        down: { DEFAULT: "#D9534F", soft: "#FCEDEC" },
        amber: { DEFAULT: "#D9901E", soft: "#FDF4E3" },
      },
      boxShadow: { sheet: "-12px 0 40px rgba(37,43,54,0.12)", pop: "0 8px 30px rgba(37,43,54,0.14)" },
    },
  },
  plugins: [],
};
