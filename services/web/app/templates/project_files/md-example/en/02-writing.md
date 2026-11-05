# How to write {#writing}

This chapter summarizes the most common patterns. For the big picture see @intro.

## Headings {#headings}

Use `#` to make headings. Numbers such as 2.1 and 2.1.1 are added for you. To skip the number, add `{.unnumbered}` at the end of the heading.

Add `{#id}` at the end of a heading so that other places can refer to it with `@id`. For example, this section is referred to as @headings.

## Images {#images}

An image alone on its line with a description gets a figure number automatically:

```markdown
![Image description](../assets/image-name.png){#fig-example width=60%}
```

## Tables {#tables}

Write the table caption on the line after the table, starting with a colon:

```markdown
| A | B |
|---|---|
| 1 | 2 |

: Table caption {#tbl-example}
```

## Thai content {#thai}

The files in the `th/` folder should use the same `{#...}` ids for headings, figures and tables so that both languages match.
