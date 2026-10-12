// Shared <picture> for the brand mark — WebP with a PNG fallback, both
// pre-sized at 96x96 (the full public/logo.png is a 640x640 source file
// kept around for generating assets from, not for shipping to the browser;
// serving it directly cost 378 KB for a 42px navbar icon).
export default function Logo({ size = 42, style, ...rest }) {
  return (
    <picture>
      <source srcSet="/logo-96.webp" type="image/webp" />
      <img
        src="/logo-96.png"
        alt="Logo"
        width={size}
        height={size}
        style={{ width: size, height: size, ...style }}
        {...rest}
      />
    </picture>
  );
}
