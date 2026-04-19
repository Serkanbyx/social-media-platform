import CreatePostForm from "../../components/post/CreatePostForm.jsx";

/**
 * CreatePostPage — standalone composer at `/posts/new` (STEP 27).
 *
 * The page intentionally stays thin: `CreatePostForm` already owns
 * draft persistence, image upload, validation, and the post-success
 * navigation back to the feed. We only render a heading + the form
 * here so the same composer can be reused inline at the top of the
 * Feed without prop-drilling page-specific concerns.
 */
export default function CreatePostPage() {
  return (
    <section aria-labelledby="create-post-title" className="space-y-4">
      <header>
        <h1
          id="create-post-title"
          className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          New post
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Share a thought, a link, or an image with the community.
        </p>
      </header>

      <CreatePostForm variant="standalone" />
    </section>
  );
}
