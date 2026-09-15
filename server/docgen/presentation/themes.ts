/**
 * Re-exports the canonical visual-style definitions from the shared module.
 *
 * The theme definitions live in @shared/pptThemes so that the theme picker
 * previews and the presentation design engine read the SAME data — a picked
 * style can never drift from what gets generated.
 */
export * from "@shared/pptThemes";