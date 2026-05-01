# Workplan: Vertical Drawing Tools & Pointer Interaction Fix

The goal is to arrange drawing tools vertically and ensure they do not block drawing on the yardage canvas.

## Proposed Changes

### [YardageDrawingBoard.js](file:///c:/Users/peter/.gemini/antigravity/scratch/golf-tracker/app/record/YardageDrawingBoard.js)

1. **Pointer Events Optimization**
   - Apply `pointer-events: none` to the main `.drawing-bottom-bar` wrapper.
   - Apply `pointer-events: auto` to the immediate child `div` containing the buttons.
   - **Result**: Clicks only get blocked when precisely over a button. All other areas of the bottom bar will let clicks pass through to the canvas.

2. **Vertical Tool Stacking**
   - Modify the marker tools container to use `flex-direction: column-reverse`.
   - Remove `flex-wrap: wrap` and `maxWidth` constraints.
   - **Result**: Tools grow vertically upwards from the toggle button.

3. **Toggle Icon UX**
   - Set toggle symbol to `▲` when tools are collapsed.
   - Set toggle symbol to `▼` when tools are expanded.

## Verification Plan

### Manual Testing
- [ ] Verify tools are arranged vertically.
- [ ] Expand tools and try drawing on the canvas directly to the right of the tool column.
- [ ] Verify that tool selection still works correctly.
- [ ] Confirm no regression in green mode tools (Flag, P1-P4).

---
위 계획에 대해 코멘트 남겨주시면 반영하도록 하겠습니다.
