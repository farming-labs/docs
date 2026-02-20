<script>
  import { onMount, tick } from "svelte";
  import { renderMarkdown } from "../lib/renderMarkdown.js";

  let {
    api = "/api/docs",
    suggestedQuestions = [],
    aiLabel = "AI",
    position = "bottom-right",
    floatingStyle = "panel",
    triggerComponent = null,
  } = $props();

  let isOpen = $state(false);
  let messages = $state([]);
  let aiInput = $state("");
  let isStreaming = $state(false);
  let mounted = $state(false);

  onMount(() => { mounted = true; });

  // ─── Position maps (match Next.js exactly) ─────────────────────

  const BTN_POSITIONS = {
    "bottom-right": "bottom:24px;right:24px",
    "bottom-left": "bottom:24px;left:24px",
    "bottom-center": "bottom:24px;left:50%;transform:translateX(-50%)",
  };

  const PANEL_POSITIONS = {
    "bottom-right": "bottom:80px;right:24px",
    "bottom-left": "bottom:80px;left:24px",
    "bottom-center": "bottom:80px;left:50%;transform:translateX(-50%)",
  };

  const POPOVER_POSITIONS = {
    "bottom-right": "bottom:80px;right:24px",
    "bottom-left": "bottom:80px;left:24px",
    "bottom-center": "bottom:80px;left:50%;transform:translateX(-50%)",
  };

  function getContainerStyle(style, pos) {
    switch (style) {
      case "modal":
        return "top:50%;left:50%;transform:translate(-50%,-50%);width:min(680px,calc(100vw - 32px));height:min(560px,calc(100vh - 64px))";
      case "popover":
        return `${POPOVER_POSITIONS[pos] || POPOVER_POSITIONS["bottom-right"]};width:min(360px,calc(100vw - 48px));height:min(400px,calc(100vh - 120px))`;
      case "panel":
      default:
        return `${PANEL_POSITIONS[pos] || PANEL_POSITIONS["bottom-right"]};width:min(400px,calc(100vw - 48px));height:min(500px,calc(100vh - 120px))`;
    }
  }

  function getAnimation(style) {
    return style === "modal"
      ? "fd-ai-float-center-in 200ms ease-out"
      : "fd-ai-float-in 200ms ease-out";
  }

  // ─── Shared logic ──────────────────────────────────────────────

  function handleKeydown(e) {
    if (e.key === "Escape" && isOpen) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (isOpen && (floatingStyle === "modal" || floatingStyle === "full-modal")) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  });

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

  function clearChat() {
    if (!isStreaming) {
      messages = [];
      aiInput = "";
    }
  }

  let label = $derived(aiLabel || "AI");
  let canSend = $derived(!!(aiInput.trim() && !isStreaming));
  let isFullModal = $derived(floatingStyle === "full-modal");
  let isModal = $derived(floatingStyle === "modal");
  let btnStyle = $derived(BTN_POSITIONS[position] || BTN_POSITIONS["bottom-right"]);
  let containerStyle = $derived(getContainerStyle(floatingStyle, position));
  let animation = $derived(getAnimation(floatingStyle));
  let showSuggestions = $derived(messages.length === 0 && !isStreaming);

  // ─── Full-modal refs ───────────────────────────────────────────

  let fmInputEl = $state(null);
  let fmListEl = $state(null);

  // ─── Panel/modal/popover refs ──────────────────────────────────

  let aiInputEl = $state(null);
  let messagesEndEl = $state(null);

  $effect(() => {
    if (isOpen && isFullModal) {
      setTimeout(() => fmInputEl?.focus(), 100);
    } else if (isOpen && !isFullModal) {
      setTimeout(() => aiInputEl?.focus(), 100);
    }
  });

  $effect(() => {
    if (isFullModal && fmListEl && messages.length > 0) {
      tick().then(() => {
        fmListEl?.scrollTo({ top: fmListEl.scrollHeight, behavior: "smooth" });
      });
    }
  });

  $effect(() => {
    if (!isFullModal && messages.length > 0) {
      tick().then(() => messagesEndEl?.scrollIntoView({ behavior: "smooth" }));
    }
  });

  function handleFmKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) submitQuestion(aiInput);
    }
  }

  function handleInputKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion(aiInput);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if mounted}
  {#if isFullModal}
    <!-- ═══ Full-Modal Mode (better-auth inspired) ═══ -->

    {#if isOpen}
      <!-- Full-screen overlay -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="fd-ai-fm-overlay" onclick={(e) => { if (e.target === e.currentTarget) isOpen = false; }}>
        <!-- Close button -->
        <div class="fd-ai-fm-topbar">
          <button onclick={() => isOpen = false} class="fd-ai-fm-close-btn" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- Scrollable message list -->
        <div bind:this={fmListEl} class="fd-ai-fm-messages">
          <div class="fd-ai-fm-messages-inner">
            {#each messages as msg}
              <div class="fd-ai-fm-msg" data-role={msg.role}>
                <div class="fd-ai-fm-msg-label" data-role={msg.role}>
                  {msg.role === "user" ? "you" : label}
                </div>
                <div class="fd-ai-fm-msg-content">
                  {#if msg.content}
                    {@html renderMarkdown(msg.content)}
                  {:else}
                    <div class="fd-ai-fm-thinking">
                      <span class="fd-ai-fm-thinking-dot"></span>
                      <span class="fd-ai-fm-thinking-dot"></span>
                      <span class="fd-ai-fm-thinking-dot"></span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Bottom input bar — always visible when open, pinned to bottom -->
    <div
      class="fd-ai-fm-input-bar {isOpen ? 'fd-ai-fm-input-bar--open' : 'fd-ai-fm-input-bar--closed'}"
      style={isOpen ? undefined : btnStyle}
    >
      {#if !isOpen}
        {#if triggerComponent}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => isOpen = true}
            class="fd-ai-floating-trigger"
            style={btnStyle}
          >
            <svelte:component this={triggerComponent} />
          </div>
        {:else}
          <button
            onclick={() => isOpen = true}
            class="fd-ai-fm-trigger-btn"
            aria-label="Ask {label}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="M20 3v4"/><path d="M22 5h-4"/>
            </svg>
            <span>Ask {label}</span>
          </button>
        {/if}
      {:else}
        <div class="fd-ai-fm-input-container">
          <div class="fd-ai-fm-input-wrap">
            <textarea
              bind:this={fmInputEl}
              class="fd-ai-fm-input"
              placeholder={isStreaming ? "answering..." : `Ask ${label}`}
              bind:value={aiInput}
              onkeydown={handleFmKeyDown}
              disabled={isStreaming}
              rows="1"
            ></textarea>
            {#if isStreaming}
              <button class="fd-ai-fm-send-btn" onclick={() => isStreaming = false} aria-label="Stop">
                <span class="fd-ai-loading-dots">
                  <span class="fd-ai-loading-dot"></span>
                  <span class="fd-ai-loading-dot"></span>
                  <span class="fd-ai-loading-dot"></span>
                </span>
              </button>
            {:else}
              <button
                class="fd-ai-fm-send-btn"
                data-active={canSend}
                disabled={!canSend}
                onclick={() => submitQuestion(aiInput)}
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
                </svg>
              </button>
            {/if}
          </div>

          {#if showSuggestions && suggestedQuestions && suggestedQuestions.length > 0}
            <div class="fd-ai-fm-suggestions-area">
              <div class="fd-ai-fm-suggestions-label">Try asking:</div>
              <div class="fd-ai-fm-suggestions">
                {#each suggestedQuestions as q}
                  <button onclick={() => submitQuestion(q)} class="fd-ai-fm-suggestion">
                    {q}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <div class="fd-ai-fm-footer-bar">
            {#if messages.length > 0}
              <button
                class="fd-ai-fm-clear-btn"
                onclick={clearChat}
                aria-disabled={isStreaming}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                <span>Clear</span>
              </button>
            {:else}
              <div class="fd-ai-fm-footer-hint">
                AI can be inaccurate, please verify the information.
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

  {:else}
    <!-- ═══ Panel / Modal / Popover Mode ═══ -->

    {#if isOpen && isModal}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="fd-ai-overlay" onclick={() => isOpen = false}></div>
    {/if}

    {#if isOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="fd-ai-dialog"
        onclick={(e) => e.stopPropagation()}
        style="{containerStyle};animation:{animation}"
      >
        <div class="fd-ai-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
          <span class="fd-ai-header-title">Ask {label}</span>
          {#if isModal}
            <kbd class="fd-ai-esc">ESC</kbd>
          {/if}
          <button onclick={() => isOpen = false} class="fd-ai-close-btn" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- AIChat equivalent -->
        <div style="display:flex;flex-direction:column;flex:1;min-height:0">
          <div class="fd-ai-messages">
            {#if messages.length === 0}
              <div class="fd-ai-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  <path d="M20 3v4"/><path d="M22 5h-4"/>
                </svg>
                <div class="fd-ai-empty-title">Ask anything about the docs</div>
                <div class="fd-ai-empty-desc">
                  {label} will search through the documentation and answer your question with relevant context.
                </div>
                {#if suggestedQuestions && suggestedQuestions.length > 0}
                  <div class="fd-ai-suggestions">
                    {#each suggestedQuestions as q}
                      <button onclick={() => submitQuestion(q)} class="fd-ai-suggestion">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
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
                    {msg.role === "user" ? "You" : label}
                  </div>
                  {#if msg.role === "user"}
                    <div class="fd-ai-bubble-user">{msg.content}</div>
                  {:else}
                    <div class="fd-ai-bubble-ai">
                      {#if msg.content}
                        {@html renderMarkdown(msg.content)}
                      {:else}
                        <span class="fd-ai-loading">
                          <span class="fd-ai-loading-text">{label} is thinking</span>
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
                onkeydown={handleInputKeydown}
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
                  <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if !isOpen}
      {#if triggerComponent}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => isOpen = true}
          class="fd-ai-floating-trigger"
          style={btnStyle}
        >
          <svelte:component this={triggerComponent} />
        </div>
      {:else}
        <button
          onclick={() => isOpen = true}
          aria-label="Ask {label}"
          class="fd-ai-floating-btn"
          style={btnStyle}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/><path d="M22 5h-4"/>
          </svg>
          <span>Ask {label}</span>
        </button>
      {/if}
    {/if}
  {/if}
{/if}
