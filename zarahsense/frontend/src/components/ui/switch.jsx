export function Switch({ checked, onCheckedChange, ...props }) {
  return (
    <input
      {...props}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className={`h-4 w-4 cursor-pointer accent-primary ${props.className || ''}`}
    />
  );
}
