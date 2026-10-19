import type { Config } from "dompurify";

// Una sola política para preview, histórico y generación server-side.
export function contractSanitizeRules(): Config {
  return {
    ALLOWED_TAGS: ["p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "small", "sub", "sup", "blockquote", "pre", "code", "hr", "ul", "ol", "li", "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td", "section", "article", "header", "footer", "main"],
    ALLOWED_ATTR: ["style", "colspan", "rowspan", "scope", "dir", "lang"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  };
}
