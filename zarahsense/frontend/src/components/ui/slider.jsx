export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, ...props }) {
  return (
    <input
      {...props}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(event) => onValueChange([Number(event.target.value)])}
      className={`w-full cursor-pointer accent-primary ${props.className || ''}`}
    />
  );
}
