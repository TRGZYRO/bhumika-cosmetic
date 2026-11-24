import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "../components/Reveal";

export default function NotFound() {
  return (
    <section className="section-dark flex min-h-[80vh] flex-col items-center justify-center px-6 pb-24 pt-40 text-center">
      <Reveal immediate>
        <div className="ornament mb-8 text-petal">
          <span className="diamond" />
        </div>
      </Reveal>
      <Reveal as="h1" immediate delay={100} className="mb-6 text-6xl font-semibold text-white md:text-8xl">
        Page not found.
      </Reveal>
      <Reveal immediate delay={200}>
        <p className="mb-12 max-w-md text-lg leading-relaxed text-mauve">
          This corner of Bhumika Cosmetic doesn&rsquo;t exist. Let&rsquo;s get you back to the good stuff.
        </p>
        <Link to="/" className="btn btn-primary px-8 py-4">
          Back to Home <ArrowRight size={18} />
        </Link>
      </Reveal>
    </section>
  );
}
