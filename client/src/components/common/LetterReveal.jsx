// Renders text as individual animated letters with a staggered entrance —
// each character scales/slides in one after another instead of the whole
// string appearing at once. Used for big "title card" style reveals.
// Usage: <LetterReveal text="Vinoth" className="text-3xl font-extrabold text-gold" />
export default function LetterReveal({ text, className, staggerMs = 45, startDelayMs = 300 }) {
  return (
    <span className={className}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="animate-letter-in"
          style={{ animationDelay: `${startDelayMs + i * staggerMs}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  )
}