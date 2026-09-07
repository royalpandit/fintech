// Advisors get the same holding detail investors do - the paper book, the
// three agent reads and the fill history are identical, and the page itself
// only checks that someone is signed in. Re-exporting keeps one implementation
// rather than a copy that drifts; the difference is purely which shell renders
// it, which the route already decides.
export { default, dynamic } from "@/app/user/portfolio/[symbol]/page";
