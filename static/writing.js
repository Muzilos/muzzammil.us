(() => {
  const status = document.querySelector("#writing-status");
  const container = document.querySelector("#writing-posts");

  loadPosts();

  async function loadPosts() {
    try {
      const response = await fetch("/api/writing/posts", { headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Writing could not be loaded.");
      render(result.posts || []);
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("writing-error");
    }
  }

  function render(posts) {
    status.hidden = true;
    const selectedSlug = new URLSearchParams(window.location.search).get("post");
    if (selectedSlug) {
      const post = posts.find((entry) => entry.slug === selectedSlug);
      if (post) {
        document.title = `${post.title} — Muzzammil Mehdi`;
        container.append(createFullPost(post, true));
        return;
      }
      status.hidden = false;
      status.textContent = "That thought could not be found.";
      status.classList.add("writing-error");
      return;
    }

    if (posts.length === 0) {
      status.hidden = false;
      status.textContent = "Nothing here yet.";
      return;
    }

    for (const post of posts) container.append(createFullPost(post, false));
  }

  function createFullPost(post, isPermalink) {
    const article = document.createElement("article");
    article.className = "writing-post";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    if (isPermalink) {
      title.textContent = post.title;
    } else {
      const link = document.createElement("a");
      link.href = `?post=${encodeURIComponent(post.slug)}`;
      link.textContent = post.title;
      title.append(link);
    }
    const date = document.createElement("time");
    date.dateTime = post.publishedAt;
    date.textContent = formatDate(post.publishedAt);
    header.append(title, date);
    article.append(header);

    if (post.summary) {
      const summary = document.createElement("p");
      summary.className = "writing-summary";
      summary.textContent = post.summary;
      article.append(summary);
    }

    const body = document.createElement("div");
    body.className = "writing-body";
    body.textContent = post.body;
    article.append(body);

    if (isPermalink) {
      const back = document.createElement("a");
      back.className = "writing-back";
      back.href = "./";
      back.textContent = "← All writing";
      article.append(back);
    }
    return article;
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(value));
  }
})();
