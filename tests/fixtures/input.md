# Heading 1
## Heading 2
### Heading 3

This is a simple paragraph without any formatting.

This is a paragraph with **bold**, *italic*, ~strike~, `code`, and [link](https://example.com).

- Bullet 1
- Bullet 2

1. Number 1
2. Number 2

> This is a quote.

```javascript
console.log('Code block');
```

This is a paragraph with text styles: **bold**, *italic*, ~strike~, `code`. And with non-formatted mentions: @jdoe, @here, @devs, #general. And with formatted mentions: <@U12345>, <#C00001>, <@S12345>, <@here>, <@T123456>.
Mentiones and styles inside code block are ignored: `<@U12345>, <#C00001>, <@S12345>, <@here>, <@T123456>, @jdoe, @here, @devs, #general, **bold**, *italic*, ~strike~ ` 

```
Hello there, I am preformatted block!
I can have multiple paragraph breaks within the block.
Mentiones and styles inside preformatted block are ignored: <@U12345>, <#C00001>, <@S12345>, <@here>, <@T123456>, @jdoe, @here, @devs, #general, **bold**, *italic*, ~strike~
```

![Image](https://picsum.photos/200)

---

| Column 1 | Column 2 |
| --- | --- |
| Cell can contain multiple paragraphs. | Paragraphs can include text styles: **bold**, \n *italic*, ~strike~, `code`. \n and  formatted mentions only: <@U12345>, <#C00001>, <@S12345>, <@here>, <@T123456>. \n Must be manually split with newlines. |
|  |  |
| Cell can contain multiple paragraphs. | Cells |

## Rich Text Elements
- User: @jdoe
- Channel: #general
- Group: @devs
- Broadcast: @here
- Color: #ff0000
- Team: @T123456
- Unknown User: @unknown
- Unknown Channel: #unknown
- Unknown Group: @unknown_group
- Unknown Team: @unknown_team

## Complex Lists

- Level 1 item
  - Level 2 item with **bold** text
  - Level 2 item with *italic* text
  - Level 2 item with ~strike~ text
  - Level 2 item with `code` snippet
  - Level 2 item with [link](https://example.com)
  - Level 2 nested item
    - Level 3 item

1. Ordered Level 1
   1. Ordered Level 2 with **bold**

## Format-wrapped lists

~1. Strike-wrapped list~

Previously strike-wrapped lists were not supported.

**2. Bold-wrapped list with nested list**

Previously Bold-wrapped lists were not supported.

*3. Italic-wrapped list*

Previously Italic-wrapped lists were not supported.

- [ ] Checkbox-wrapped list item~

Previously strike-wrapped unordered lists were not supported.

- Level 1 item
  **- Nested bold item**
