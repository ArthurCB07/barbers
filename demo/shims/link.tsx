/** Substituto de next/link fora do Next.js */
export default function Link({ href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props} />;
}
