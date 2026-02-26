<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { renderMarkdown } from "../lib/renderMarkdown.js";

const props = withDefaults(
  defineProps<{
    api?: string;
    suggestedQuestions?: string[];
    aiLabel?: string;
    position?: string;
    floatingStyle?: "panel" | "modal" | "popover" | "full-modal";
    triggerComponent?: object | null;
  }>(),
  {
    api: "/api/docs",
    suggestedQuestions: () => [],
    aiLabel: "AI",
    position: "bottom-right",
    floatingStyle: "panel",
    triggerComponent: null,
  },
);

const mounted = ref(false);
const isOpen = ref(false);
const messages = ref<{ role: string; content: string }[]>([]);
const aiInput = ref("");
const isStreaming = ref(false);
const fmListEl = ref<HTMLElement | null>(null);
const fmInputEl = ref<HTMLTextAreaElement | null>(null);
const messagesEndEl = ref<HTMLElement | null>(null);

onMounted(() => {
  mounted.value = true;
});

const isFullModal = computed(() => props.floatingStyle === "full-modal");
const isModal = computed(() => props.floatingStyle === "modal");
const label = computed(() => props.aiLabel || "AI");
const canSend = computed(() => !!aiInput.value.trim() && !isStreaming.value);
const showSuggestions = computed(() => messages.value.length === 0 && !isStreaming.value);

const BTN_POSITIONS: Record<string, string> = {
  "bottom-right": "bottom:24px;right:24px",
  "bottom-left": "bottom:24px;left:24px",
  "bottom-center": "bottom:24px;left:50%;transform:translateX(-50%)",
};

const PANEL_POSITIONS: Record<string, string> = {
  "bottom-right": "bottom:80px;right:24px",
  "bottom-left": "bottom:80px;left:24px",
  "bottom-center": "bottom:80px;left:50%;transform:translateX(-50%)",
};

const btnStyle = computed(() => BTN_POSITIONS[props.position] ?? BTN_POSITIONS["bottom-right"]);

const containerStyle = computed(() => {
  switch (props.floatingStyle) {
    case "modal":
      return "top:50%;left:50%;transform:translate(-50%,-50%);width:min(680px,calc(100vw - 32px));height:min(560px,calc(100vh - 64px))";
    case "popover":
      return `${PANEL_POSITIONS[props.position] ?? PANEL_POSITIONS["bottom-right"]};width:min(360px,calc(100vw - 48px));height:min(400px,calc(100vh - 120px))`;
    default:
      return `${PANEL_POSITIONS[props.position] ?? PANEL_POSITIONS["bottom-right"]};width:min(400px,calc(100vw - 48px));height:min(500px,calc(100vh - 120px))`;
  }
});

const animation = computed(() =>
  props.floatingStyle === "modal"
    ? "fd-ai-float-center-in 200ms ease-out"
    : "fd-ai-float-in 200ms ease-out",
);

watch(isOpen, (open) => {
  if (open && (isModal.value || isFullModal.value)) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
  if (open && isFullModal.value) {
    nextTick(() => fmInputEl.value?.focus());
  }
  if (open && !isFullModal.value) {
    nextTick(() => {
      const input = document.querySelector(".fd-ai-input") as HTMLInputElement;
      input?.focus();
    });
  }
});

watch(
  () => messages.value.length,
  () => {
    if (isFullModal.value && fmListEl.value) {
      nextTick(() =>
        fmListEl.value?.scrollTo({ top: fmListEl.value.scrollHeight, behavior: "smooth" }),
      );
    }
    if (!isFullModal.value) {
      nextTick(() => messagesEndEl.value?.scrollIntoView({ behavior: "smooth" }));
    }
  },
);

async function submitQuestion(question: string) {
  if (!question.trim() || isStreaming.value) return;
  const userMsg = { role: "user", content: question };
  const newMessages = [...messages.value, userMsg];
  aiInput.value = "";
  isStreaming.value = true;
  messages.value = [...newMessages, { role: "assistant", content: "" }];

  try {
    const res = await fetch(props.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      messages.value = [
        ...newMessages,
        { role: "assistant", content: (err as any).error ?? "Something went wrong." },
      ];
      isStreaming.value = false;
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              messages.value = [...newMessages, { role: "assistant", content: assistantContent }];
            }
          } catch {}
        }
      }
    }
    messages.value = [...newMessages, { role: "assistant", content: assistantContent }];
  } catch {
    messages.value = [
      ...newMessages,
      { role: "assistant", content: "Failed to connect. Please try again." },
    ];
  }
  isStreaming.value = false;
}

function clearChat() {
  if (!isStreaming.value) {
    messages.value = [];
    aiInput.value = "";
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isOpen.value) isOpen.value = false;
}

function handleFmKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitQuestion(aiInput.value);
  }
}
</script>

<template>
  <!-- ═══ FULL-MODAL: overlay + messages (only when full-modal AND open) ═══ -->
  <Teleport to="body" v-if="mounted && isFullModal && isOpen">
    <div class="fd-ai-fm-overlay" @click.self="isOpen = false" @keydown="handleKeydown">
      <div class="fd-ai-fm-topbar">
        <button class="fd-ai-fm-close-btn" type="button" aria-label="Close" @click="isOpen = false">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div ref="fmListEl" class="fd-ai-fm-messages">
        <div class="fd-ai-fm-messages-inner">
          <div v-for="(msg, i) in messages" :key="i" class="fd-ai-fm-msg" :data-role="msg.role">
            <div class="fd-ai-fm-msg-label" :data-role="msg.role">
              {{ msg.role === "user" ? "you" : label }}
            </div>
            <div class="fd-ai-fm-msg-content">
              <template v-if="msg.content">
                <div :class="isStreaming && i === messages.length - 1 && msg.role === 'assistant' ? 'fd-ai-streaming' : ''" v-html="renderMarkdown(msg.content)" />
              </template>
              <div v-else class="fd-ai-loader">
                <span class="fd-ai-loader-shimmer-text">Thinking</span>
                <span class="fd-ai-loader-typing-dots">
                  <span class="fd-ai-loader-typing-dot" />
                  <span class="fd-ai-loader-typing-dot" />
                  <span class="fd-ai-loader-typing-dot" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ═══ FULL-MODAL: bottom input bar (only when full-modal) ═══ -->
  <Teleport to="body" v-if="mounted && isFullModal">
    <div
      class="fd-ai-fm-input-bar"
      :class="isOpen ? 'fd-ai-fm-input-bar--open' : 'fd-ai-fm-input-bar--closed'"
      :style="isOpen ? undefined : btnStyle"
    >
      <div
        v-if="!isOpen && triggerComponent"
        class="fd-ai-floating-trigger"
        :style="btnStyle"
        @click="isOpen = true"
      >
        <component :is="triggerComponent" :ai-label="label" />
      </div>
      <button
        v-else-if="!isOpen"
        class="fd-ai-fm-trigger-btn"
        type="button"
        :aria-label="`Ask ${label}`"
        @click="isOpen = true"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
        </svg>
        <span>Ask {{ label }}</span>
      </button>

      <div v-else class="fd-ai-fm-input-container">
        <div class="fd-ai-fm-input-wrap">
          <textarea
            ref="fmInputEl"
            v-model="aiInput"
            class="fd-ai-fm-input"
            :placeholder="isStreaming ? 'answering...' : `Ask ${label}`"
            :disabled="isStreaming"
            rows="1"
            @keydown="handleFmKeyDown"
          />
          <button
            v-if="isStreaming"
            class="fd-ai-fm-send-btn"
            type="button"
            aria-label="Stop"
            @click="isStreaming = false"
          >
            <span class="fd-ai-loader-typing-dots" style="margin-left:0">
              <span class="fd-ai-loader-typing-dot" />
              <span class="fd-ai-loader-typing-dot" />
              <span class="fd-ai-loader-typing-dot" />
            </span>
          </button>
          <button
            v-else
            class="fd-ai-fm-send-btn"
            type="button"
            :data-active="canSend"
            :disabled="!canSend"
            aria-label="Send"
            @click="submitQuestion(aiInput)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          </button>
        </div>

        <div
          v-if="showSuggestions && suggestedQuestions.length > 0"
          class="fd-ai-fm-suggestions-area"
        >
          <div class="fd-ai-fm-suggestions-label">Try asking:</div>
          <div class="fd-ai-fm-suggestions">
            <button
              v-for="q in suggestedQuestions"
              :key="q"
              type="button"
              class="fd-ai-fm-suggestion"
              @click="submitQuestion(q)"
            >
              {{ q }}
            </button>
          </div>
        </div>

        <div class="fd-ai-fm-footer-bar">
          <button
            v-if="messages.length > 0"
            class="fd-ai-fm-clear-btn"
            type="button"
            :aria-disabled="isStreaming"
            @click="clearChat"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            <span>Clear</span>
          </button>
          <div v-else class="fd-ai-fm-footer-hint">
            AI can be inaccurate, please verify the information.
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ═══ PANEL/MODAL/POPOVER: backdrop (only for modal style when open) ═══ -->
  <Teleport to="body" v-if="mounted && !isFullModal && isOpen && isModal">
    <div class="fd-ai-overlay" @click="isOpen = false" />
  </Teleport>

  <!-- ═══ PANEL/MODAL/POPOVER: dialog (only when NOT full-modal AND open) ═══ -->
  <Teleport to="body" v-if="mounted && !isFullModal && isOpen">
    <div
      class="fd-ai-dialog"
      :style="`${containerStyle};animation:${animation}`"
      @click.stop
      @keydown="handleKeydown"
    >
      <div class="fd-ai-header">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          />
        </svg>
        <span class="fd-ai-header-title">Ask {{ label }}</span>
        <button type="button" class="fd-ai-close-btn" aria-label="Close" @click="isOpen = false">
          <kbd class="fd-ai-esc">ESC</kbd>
        </button>
      </div>

      <div class="fd-ai-messages">
        <template v-if="messages.length === 0 && !isStreaming">
          <div class="fd-ai-empty">
            <div class="fd-ai-empty-title">Ask anything about the docs</div>
            <div class="fd-ai-empty-desc">Get instant answers from the documentation.</div>
            <div v-if="suggestedQuestions.length > 0" class="fd-ai-suggestions">
              <button
                v-for="q in suggestedQuestions"
                :key="q"
                type="button"
                class="fd-ai-suggestion"
                @click="submitQuestion(q)"
              >
                {{ q }}
              </button>
            </div>
          </div>
        </template>
        <template v-for="(msg, i) in messages" :key="i">
          <div class="fd-ai-msg" :data-role="msg.role">
            <div class="fd-ai-msg-label">
              {{ msg.role === "user" ? "You" : label }}
            </div>
            <div v-if="msg.role === 'user'" class="fd-ai-bubble-user">{{ msg.content }}</div>
            <div v-else class="fd-ai-bubble-ai">
              <template v-if="msg.content">
                <div :class="isStreaming && i === messages.length - 1 ? 'fd-ai-streaming' : ''" v-html="renderMarkdown(msg.content)" />
              </template>
              <div v-else class="fd-ai-loader">
                <span class="fd-ai-loader-shimmer-text">Thinking</span>
                <span class="fd-ai-loader-typing-dots">
                  <span class="fd-ai-loader-typing-dot" />
                  <span class="fd-ai-loader-typing-dot" />
                  <span class="fd-ai-loader-typing-dot" />
                </span>
              </div>
            </div>
          </div>
        </template>
        <div ref="messagesEndEl" />
      </div>

      <div class="fd-ai-chat-footer">
        <div class="fd-ai-input-wrap">
          <input
            v-model="aiInput"
            type="text"
            class="fd-ai-input"
            :placeholder="isStreaming ? `${label} is answering...` : `Ask ${label}...`"
            :disabled="isStreaming"
            @keydown.enter.prevent="submitQuestion(aiInput)"
          />
          <button
            type="button"
            class="fd-ai-send-btn"
            :data-active="canSend"
            :disabled="!canSend"
            aria-label="Send"
            @click="submitQuestion(aiInput)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          </button>
        </div>
        <button
          v-if="messages.length > 0 && !isStreaming"
          type="button"
          class="fd-ai-clear-btn"
          @click="clearChat"
        >
          Clear conversation
        </button>
      </div>
    </div>
  </Teleport>

  <!-- ═══ PANEL/MODAL/POPOVER: icon trigger (only when NOT full-modal AND NOT open) ═══ -->
  <Teleport to="body" v-if="mounted && !isFullModal && !isOpen">
    <div
      v-if="triggerComponent"
      class="fd-ai-floating-trigger"
      :style="btnStyle"
      @click="isOpen = true"
    >
      <component :is="triggerComponent" :ai-label="label" />
    </div>
    <button
      v-else
      type="button"
      class="fd-ai-floating-btn"
      :style="btnStyle"
      :aria-label="`Ask ${label}`"
      @click="isOpen = true"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
      </svg>
      <span>Ask {{ label }}</span>
    </button>
  </Teleport>
</template>
