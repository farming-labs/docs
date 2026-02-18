<script>
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { renderMarkdown } from "../lib/renderMarkdown.js";

  let { onclose, api = "/api/docs", suggestedQuestions = [], aiLabel = "AI", hideAITab = false } = $props();

  let tab = $state("search");
  let searchQuery = $state("");
  let searchResults = $state([]);
  let isSearching = $state(false);
  let activeIndex = $state(0);

  let messages = $state([]);
  let aiInput = $state("");
  let isStreaming = $state(false);

  let searchInputEl = $state(null);
  let aiInputEl = $state(null);
  let messagesEndEl = $state(null);
  let debounceTimer;

  onMount(() => {
    document.body.style.overflow = "hidden";
    setTimeout(() => searchInputEl?.focus(), 50);
    return () => { document.body.style.overflow = ""; };
  });

  function switchTab(t) {
    tab = t;
    if (t === "search") {
      setTimeout(() => searchInputEl?.focus(), 50);
    } else {
      setTimeout(() => aiInputEl?.focus(), 50);
    }
  }

  $effect(() => {
    clearTimeout(debounceTimer);
    if (!searchQuery.trim() || tab !== "search") {
      searchResults = [];
      activeIndex = 0;
      return;
    }
    isSearching = true;
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${api}?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          searchResults = await res.json();
          activeIndex = 0;
        }
      } catch {
        searchResults = [];
      }
      isSearching = false;
    }, 150);
  });

  function navigateTo(url) {
    onclose?.();
    goto(url);
  }

  function handleSearchKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, searchResults.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter" && searchResults[activeIndex]) {
      e.preventDefault();
      navigateTo(searchResults[activeIndex].url);
    }
  }

  function handleOverlayKeydown(e) {
    if (e.key === "Escape") onclose?.();
  }

  async function submitQuestion(question) {
    if (!question.trim() || isStreaming) return;
    const userMsg = { role: "user", content: question };
    const newMessages = [...messages, userMsg];
    aiInput = "";
    isStreaming = true;
    messages = [...newMessages, { role: "assistant", content: "" }];

    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        let errMsg = "Something went wrong.";
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {}
        messages = [...newMessages, { role: "assistant", content: errMsg }];
        isStreaming = false;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                messages = [...newMessages, { role: "assistant", content: assistantContent }];
              }
            } catch {}
          }
        }
      }
      if (assistantContent) {
        messages = [...newMessages, { role: "assistant", content: assistantContent }];
      }
    } catch {
      messages = [
        ...newMessages,
        { role: "assistant", content: "Failed to connect. Please try again." },
      ];
    }
    isStreaming = false;
  }

  function handleAIKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion(aiInput);
    }
  }

  function clearChat() {
    messages = [];
    aiInput = "";
  }

  $effect(() => {
    if (messages.length > 0) {
      tick().then(() => messagesEndEl?.scrollIntoView({ behavior: "smooth" }));
    }
  });

  let canSend = $derived(aiInput.trim() && !isStreaming);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fd-ai-overlay" onclick={onclose} onkeydown={handleOverlayKeydown} role="dialog" tabindex="-1">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fd-ai-dialog"
    onclick={(e) => e.stopPropagation()}
    role="document"
    style="left:50%;top:12%;transform:translateX(-50%);width:min(640px,calc(100vw - 32px));max-height:min(520px,calc(100vh - 120px));animation:fd-ai-slide-up 200ms ease-out"
  >
    <!-- Tab bar -->
    <div class="fd-ai-tab-bar">
      <button onclick={() => switchTab("search")} class="fd-ai-tab" data-active={tab === "search"}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        Search
      </button>
      {#if !hideAITab}
        <button onclick={() => switchTab("ai")} class="fd-ai-tab" data-active={tab === "ai"}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          Ask {aiLabel}
        </button>
      {/if}
      <span style="margin-left:auto;display:flex;align-items:center;padding-right:12px">
        <kbd class="fd-ai-esc">ESC</kbd>
      </span>
    </div>

    <!-- Search tab -->
    {#if tab === "search"}
      <div style="display:flex;flex-direction:column;flex:1;min-height:0">
        <div class="fd-ai-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            bind:this={searchInputEl}
            bind:value={searchQuery}
            class="fd-ai-input"
            placeholder="Search documentation..."
            type="text"
            onkeydown={handleSearchKeydown}
          />
          {#if isSearching}
            <span class="fd-ai-loading-dots">
              <span class="fd-ai-loading-dot"></span>
              <span class="fd-ai-loading-dot"></span>
              <span class="fd-ai-loading-dot"></span>
            </span>
          {/if}
        </div>
        <div class="fd-ai-results">
          {#if searchResults.length > 0}
            {#each searchResults as result, i}
              <button
                class="fd-ai-result"
                data-active={i === activeIndex}
                onclick={() => navigateTo(result.url)}
                onmouseenter={() => { activeIndex = i; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
                <span style="flex:1">{result.content}</span>
              </button>
            {/each}
          {:else}
            <div class="fd-ai-result-empty">
              {#if searchQuery.trim()}
                {isSearching ? "Searching..." : `No results found. Try the Ask ${aiLabel} tab.`}
              {:else}
                Type to search the docs
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Ask AI tab -->
    {#if tab === "ai"}
      <div style="display:flex;flex-direction:column;flex:1;min-height:0">
        <div class="fd-ai-messages">
          {#if messages.length === 0}
            <div class="fd-ai-empty">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                <path d="M20 3v4" /><path d="M22 5h-4" />
              </svg>
              <div class="fd-ai-empty-title">Ask anything about the docs</div>
              <div class="fd-ai-empty-desc">
                {aiLabel} will search through the documentation and answer your question with relevant context.
              </div>
              {#if suggestedQuestions.length > 0}
                <div class="fd-ai-suggestions">
                  {#each suggestedQuestions as q}
                    <button onclick={() => submitQuestion(q)} class="fd-ai-suggestion">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
                      </svg>
                      <span style="flex:1">{q}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            {#each messages as msg}
              <div class="fd-ai-msg" data-role={msg.role}>
                <div class="fd-ai-msg-label">
                  {msg.role === "user" ? "You" : aiLabel}
                </div>
                {#if msg.role === "user"}
                  <div class="fd-ai-bubble-user">{msg.content}</div>
                {:else}
                  <div class="fd-ai-bubble-ai">
                    {#if msg.content}
                      {@html renderMarkdown(msg.content)}
                    {:else}
                      <span class="fd-ai-loading">
                        <span class="fd-ai-loading-text">{aiLabel} is thinking</span>
                        <span class="fd-ai-loading-dots">
                          <span class="fd-ai-loading-dot"></span>
                          <span class="fd-ai-loading-dot"></span>
                          <span class="fd-ai-loading-dot"></span>
                        </span>
                      </span>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
            <div bind:this={messagesEndEl}></div>
          {/if}
        </div>

        <div class="fd-ai-chat-footer">
          {#if messages.length > 0}
            <div style="display:flex;justify-content:flex-end;padding-bottom:8px">
              <button onclick={clearChat} class="fd-ai-clear-btn">Clear chat</button>
            </div>
          {/if}
          <div class="fd-ai-input-wrap">
            <input
              bind:this={aiInputEl}
              bind:value={aiInput}
              type="text"
              placeholder="Ask a question..."
              onkeydown={handleAIKeydown}
              disabled={isStreaming}
              class="fd-ai-input"
              style="opacity:{isStreaming ? 0.5 : 1}"
            />
            <button
              onclick={() => submitQuestion(aiInput)}
              disabled={!canSend}
              class="fd-ai-send-btn"
              data-active={canSend}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
