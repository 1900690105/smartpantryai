/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172b25",
        leaf: "#267653",
        mint: "#eaf5ee",
        cream: "#f7f8f4"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(23,43,37,.06)"
      }
    },
  },
  plugins: [],
};
