import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			screens: {
				xs: "475px",
			},
			colors: {
				primary: {
					"100": "#FFE8F0",
					DEFAULT: "#EE2B69",
				},
				secondary: "#FBE843",
				black: {
					"100": "#333333",
					"200": "#141413",
					"300": "#7D8087",
					DEFAULT: "#000000",
				},
				white: {
					"100": "#F7F7F7",
					DEFAULT: "#FFFFFF",
				},
				// Add theme colors based on CSS variables
				border: "hsl(var(--border) / <alpha-value>)",
				background: "hsl(var(--background) / <alpha-value>)",
				foreground: "hsl(var(--foreground) / <alpha-value>)",
				card: "hsl(var(--card) / <alpha-value>)",
				"card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
				popover: "hsl(var(--popover) / <alpha-value>)",
				"popover-foreground": "hsl(var(--popover-foreground) / <alpha-value>)",
				muted: "hsl(var(--muted) / <alpha-value>)",
				"muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
				accent: "hsl(var(--accent) / <alpha-value>)",
				"accent-foreground": "hsl(var(--accent-foreground) / <alpha-value>)",
				destructive: "hsl(var(--destructive) / <alpha-value>)",
				"destructive-foreground": "hsl(var(--destructive-foreground) / <alpha-value>)",
				input: "hsl(var(--input) / <alpha-value>)",
				ring: "hsl(var(--ring) / <alpha-value>)",
				"primary-foreground": "hsl(var(--primary-foreground) / <alpha-value>)",
			},
			fontFamily: {
				"work-sans": ["var(--font-work-sans)"],
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			boxShadow: {
				100: "2px 2px 0px 0px rgb(0, 0, 0)",
				200: "2px 2px 0px 2px rgb(0, 0, 0)",
				300: "2px 2px 0px 2px rgb(238, 43, 105)",
			},
		},
	},
	plugins: [tailwindcssAnimate, typography],
};

export default config;