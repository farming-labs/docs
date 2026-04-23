# Customize
URL: /docs/customize
Description: Customize the look and feel of your documentation. # Customize

 Make documentation site uniquely with themes, fonts custom
 components.

 ## Theming

 Choose from built-in themes or create own:

```tsx
import { greentree } from "@farming-labs/theme/greentree";

export default defineDocs({
  theme: greentree({
    /* overrides */
  }),
});
``` ## Available Themes

 Nine built-in themes:

| Theme         | Description                                    |
| --------------| ---------------------------------------------- |
| `fumadocs` Default theme with clean design  |
| `darksharp` | All-black, sharp corners                   |
| `pixel-border` Refined dark UI inspired by better-auth.com  `colorful` Fumadocs-style neutral with description support|
 `greentree` Green-accented Mintlify-inspired theme   |
| `darkbold` Monochrome Vercel-inspired theme    |
 `shiny` Glossy modern theme               |
 `hardline` Hard-edge high-contrast interface   |
| `concrete` Brutalist poster-style interface loud depth |

 ## Quick Customization

 Override theme value:

```tsx
theme: greentree({
  ui: {
    colors: { primary: "#FF6B35" },
    sidebar: { style: "bordered" },
  },
});
```
