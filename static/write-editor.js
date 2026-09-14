(() => {
  const views = {
    loading: document.querySelector("#editor-loading"),
    setup: document.querySelector("#setup-view"),
    login: document.querySelector("#login-view"),
    editor: document.querySelector("#editor-view")
  };
  const logoutButton = document.querySelector("#logout-button");
  const setupForm = document.querySelector("#setup-form");
  const loginForm = document.querySelector("#login-form");
  const postForm = document.querySelector("#post-form");
  const postList = document.querySelector("#editor-posts");
  const fields = {
    id: document.querySelector("#post-id"),
    title: document.querySelector("#post-title"),
    summary: document.querySelector("#post-summary"),
    body: document.querySelector("#post-body"),
    status: document.querySelector("#post-status")
  };
  const editorMode = document.querySelector("#editor-mode");
  const saveState = document.querySelector("#save-state");
  const deleteButton = document.querySelector("#delete-post-button");
  let posts = [];

  setupForm.addEventListener("submit", setupPassword);
  loginForm.addEventListener("submit", login);
  postForm.addEventListener("submit", savePost);
  document.querySelector("#new-post-button").addEventListener("click", newPost);
  deleteButton.addEventListener("click", deletePost);
  logoutButton.addEventListener("click", logout);
  initialize();

  async function initialize() {
    try {
      const state = await api("/api/writing/status");
      if (state.needsSetup) showView("setup");
      else if (state.authenticated) await openEditor();
      else showView("login");
    } catch (error) {
      views.loading.innerHTML = "";
      const message = document.createElement("p");
      message.className = "form-message";
      message.textContent = error.message;
      views.loading.append(message);
    }
  }

  async function setupPassword(event) {
    event.preventDefault();
    const password = document.querySelector("#setup-password").value;
    const confirmation = document.querySelector("#setup-confirmation").value;
    const message = document.querySelector("#setup-message");
    if (password !== confirmation) {
      message.textContent = "The passwords do not match.";
      return;
    }
    await submitAuthForm(setupForm, message, "/api/writing/setup", password, openEditor);
  }

  async function login(event) {
    event.preventDefault();
    await submitAuthForm(
      loginForm,
      document.querySelector("#login-message"),
      "/api/writing/login",
      document.querySelector("#login-password").value,
      openEditor
    );
  }

  async function submitAuthForm(form, message, url, password, onSuccess) {
    const button = form.querySelector("button[type=submit]");
    message.textContent = "";
    button.disabled = true;
    try {
      await api(url, { method: "POST", body: JSON.stringify({ password }) });
      form.reset();
      await onSuccess();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function openEditor() {
    const result = await api("/api/writing/posts?scope=all");
    posts = result.posts || [];
    renderPostList();
    showView("editor");
    logoutButton.hidden = false;
    if (posts.length > 0) selectPost(posts[0].id);
    else newPost();
  }

  function renderPostList() {
    postList.innerHTML = "";
    if (posts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "editor-empty";
      empty.textContent = "Your saved thoughts will appear here.";
      postList.append(empty);
      return;
    }
    for (const post of posts) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "editor-post-item";
      button.dataset.id = post.id;
      const title = document.createElement("strong");
      title.textContent = post.title;
      const detail = document.createElement("span");
      detail.textContent = `${post.status} · ${formatShortDate(post.updatedAt)}`;
      button.append(title, detail);
      button.addEventListener("click", () => selectPost(post.id));
      postList.append(button);
    }
  }

  function selectPost(id) {
    const post = posts.find((entry) => entry.id === Number(id));
    if (!post) return;
    fields.id.value = post.id;
    fields.title.value = post.title;
    fields.summary.value = post.summary;
    fields.body.value = post.body;
    fields.status.value = post.status;
    editorMode.textContent = "Edit thought";
    saveState.textContent = "";
    deleteButton.hidden = false;
    for (const item of postList.querySelectorAll(".editor-post-item")) {
      item.classList.toggle("active", Number(item.dataset.id) === post.id);
    }
  }

  function newPost() {
    postForm.reset();
    fields.id.value = "";
    fields.status.value = "draft";
    editorMode.textContent = "New thought";
    saveState.textContent = "";
    deleteButton.hidden = true;
    for (const item of postList.querySelectorAll(".editor-post-item")) item.classList.remove("active");
    fields.title.focus();
  }

  async function savePost(event) {
    event.preventDefault();
    const submit = postForm.querySelector("button[type=submit]");
    const id = fields.id.value;
    const payload = {
      title: fields.title.value,
      summary: fields.summary.value,
      body: fields.body.value,
      status: fields.status.value
    };
    submit.disabled = true;
    saveState.textContent = "Saving…";
    try {
      const result = await api(id ? `/api/writing/posts/${id}` : "/api/writing/posts", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      const index = posts.findIndex((post) => post.id === result.post.id);
      if (index === -1) posts.unshift(result.post);
      else posts[index] = result.post;
      posts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      renderPostList();
      selectPost(result.post.id);
      saveState.textContent = result.post.status === "published" ? "Published" : "Saved as draft";
    } catch (error) {
      saveState.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }

  async function deletePost() {
    const id = Number(fields.id.value);
    const post = posts.find((entry) => entry.id === id);
    if (!post || !window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    deleteButton.disabled = true;
    try {
      await api(`/api/writing/posts/${id}`, { method: "DELETE" });
      posts = posts.filter((entry) => entry.id !== id);
      renderPostList();
      if (posts.length > 0) selectPost(posts[0].id);
      else newPost();
    } catch (error) {
      saveState.textContent = error.message;
    } finally {
      deleteButton.disabled = false;
    }
  }

  async function logout() {
    logoutButton.disabled = true;
    try {
      await api("/api/writing/logout", { method: "POST" });
      posts = [];
      logoutButton.hidden = true;
      showView("login");
    } catch (error) {
      saveState.textContent = error.message;
    } finally {
      logoutButton.disabled = false;
    }
  }

  function showView(name) {
    for (const [viewName, view] of Object.entries(views)) view.hidden = viewName !== name;
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...options.headers }
    });
    let result = {};
    try {
      result = await response.json();
    } catch {
      // The status below still produces a useful error if the response is not JSON.
    }
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  function formatShortDate(value) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
  }
})();
