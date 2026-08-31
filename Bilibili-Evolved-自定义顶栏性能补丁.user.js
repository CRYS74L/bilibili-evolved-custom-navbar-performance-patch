// ==UserScript==
// @name         Bilibili Evolved 自定义顶栏性能补丁
// @namespace    codex.local.bilibili-evolved.custom-navbar-performance
// @version      1.3.1
// @description  避免自定义顶栏反复重算整个卡片子树，并仅渲染待看列表的视口附近卡片，同时保留原有视觉过渡和功能。
// @author       Local patch
// @license      MIT
// @match        https://t.bilibili.com/*
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://search.bilibili.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  /*
   * Bilibili Evolved 2.11.3 uses the navbar-popup-in keyframe only to turn
   * pointer-events back on after a short delay. Since pointer-events is an
   * inherited property, animating it invalidates styles throughout a large
   * popup card subtree on every hover switch.
   *
   * This override keeps the popup's existing opacity, position, cover-hover,
   * floating-label, and card enter/leave transitions. It only replaces that
   * non-visual pointer-events keyframe with its final state immediately.
   */
  GM_addStyle(`
    /*
     * Bilibili Evolved applies transition: all to every popup descendant.
     * When pointer-events changes on the popup, Chromium consequently starts
     * a discrete transition on thousands of descendants. Keep the visual
     * transition properties explicitly, while excluding pointer-events.
     */
    .custom-navbar-item .popup > *,
    .custom-navbar-item .popup > * *,
    .custom-navbar-item .popup > * *::before,
    .custom-navbar-item .popup > * *::after {
      transition-property:
        color, background-color, border-color, outline-color,
        text-decoration-color, fill, stroke, opacity, box-shadow,
        transform, translate, scale, rotate, filter, backdrop-filter,
        width, height, min-width, min-height, max-width, max-height,
        margin, padding, inset, top, right, bottom, left,
        border-radius !important;
    }

    /*
     * The watch-later popup eagerly creates up to 999 cards (over 11,000 DOM
     * descendants) on its first hover. Keep the full list and scroll range,
     * while skipping the rendering of cards outside the popup viewport.
     * JavaScript below marks only the viewport and its small overscan range
     * as visible. This deliberately avoids content-visibility:auto: applying
     * auto to all 999 cards makes Chromium continuously run intersection
     * observation and lifecycle work for every card.
     */
    .custom-navbar .watchlater-list .watchlater-card {
      content-visibility: hidden !important;
      contain-intrinsic-size: auto 86.5px !important;
    }

    .custom-navbar .watchlater-list .watchlater-card.bep-watchlater-visible {
      content-visibility: visible !important;
    }

    .custom-navbar-item:not(.disabled):hover .popup-container > .popup,
    .custom-navbar-item:not(.disabled).input-within .popup-container > .popup {
      animation: none !important;
      pointer-events: initial !important;
    }
  `);

  const watchlaterSelector =
    '.custom-navbar .watchlater-list .watchlater-list-content';
  const cardSelector = '.watchlater-card';
  const visibleClass = 'bep-watchlater-visible';
  const fallbackCardHeight = 86.5;
  const overscanCards = 8;

  let currentScroller = null;
  let currentController = null;
  let discoveryFrame = 0;

  const createController = scroller => {
    let cards = [];
    let visibleStart = 0;
    let visibleEnd = 0;
    let updateFrame = 0;
    let cardsChanged = true;

    const clearVisibleRange = () => {
      for (let index = visibleStart; index < visibleEnd; index += 1) {
        cards[index]?.classList.remove(visibleClass);
      }
      visibleStart = 0;
      visibleEnd = 0;
    };

    const update = () => {
      updateFrame = 0;

      if (!scroller.isConnected) {
        return;
      }

      if (cardsChanged) {
        clearVisibleRange();
        cards = Array.from(scroller.children).filter(element =>
          element.matches?.(cardSelector),
        );
        cardsChanged = false;
      }

      if (cards.length === 0) {
        return;
      }

      const measuredHeight = cards[0].getBoundingClientRect().height;
      const cardHeight = measuredHeight > 0
        ? measuredHeight
        : fallbackCardHeight;
      const nextStart = Math.max(
        0,
        Math.floor(scroller.scrollTop / cardHeight) - overscanCards,
      );
      const nextEnd = Math.min(
        cards.length,
        Math.ceil(
          (scroller.scrollTop + scroller.clientHeight) / cardHeight,
        ) + overscanCards,
      );

      for (let index = visibleStart; index < visibleEnd; index += 1) {
        if (index < nextStart || index >= nextEnd) {
          cards[index]?.classList.remove(visibleClass);
        }
      }
      for (let index = nextStart; index < nextEnd; index += 1) {
        if (index < visibleStart || index >= visibleEnd) {
          cards[index]?.classList.add(visibleClass);
        }
      }

      visibleStart = nextStart;
      visibleEnd = nextEnd;
    };

    const scheduleUpdate = () => {
      if (updateFrame === 0) {
        updateFrame = requestAnimationFrame(update);
      }
    };

    const listObserver = new MutationObserver(() => {
      cardsChanged = true;
      scheduleUpdate();
    });
    listObserver.observe(scroller, { childList: true });
    scroller.addEventListener('scroll', scheduleUpdate, { passive: true });
    scheduleUpdate();

    return {
      destroy() {
        listObserver.disconnect();
        scroller.removeEventListener('scroll', scheduleUpdate);
        if (updateFrame !== 0) {
          cancelAnimationFrame(updateFrame);
        }
        clearVisibleRange();
      },
    };
  };

  const discoverScroller = () => {
    discoveryFrame = 0;
    const nextScroller = document.querySelector(watchlaterSelector);

    if (nextScroller === currentScroller) {
      return;
    }

    currentController?.destroy();
    currentScroller = nextScroller;
    currentController = nextScroller ? createController(nextScroller) : null;
  };

  const scheduleDiscovery = () => {
    if (currentScroller?.isConnected) {
      return;
    }
    if (discoveryFrame === 0) {
      discoveryFrame = requestAnimationFrame(discoverScroller);
    }
  };

  const start = () => {
    discoverScroller();
    const discoveryObserver = new MutationObserver(scheduleDiscovery);
    discoveryObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
