"use client";

import { useEffect, useState } from "react";
import { initializePaddle } from "@paddle/paddle-js";

export function PaddleCheckout({ transactionId, token, sandbox, zh }: {
  transactionId: string;
  token: string;
  sandbox: boolean;
  zh: boolean;
}) {
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    initializePaddle({
      token,
      environment: sandbox ? "sandbox" : "production",
      checkout: {
        settings: {
          displayMode: "overlay",
          locale: zh ? "zh" : "en",
          successUrl: `${window.location.origin}/billing/success`,
        },
      },
    })
      .then((paddle) => {
        if (active && paddle) paddle.Checkout.open({ transactionId });
        else if (active) setError(true);
      })
      .catch(() => active && setError(true));
    return () => { active = false; };
  }, [sandbox, token, transactionId, zh]);
  return error ? (
    <p className="text-red-700">{zh ? "结账加载失败，请返回价格页重试。" : "Checkout failed to load. Return to pricing and try again."}</p>
  ) : (
    <p>{zh ? "正在打开 Paddle 安全结账…" : "Opening secure Paddle checkout…"}</p>
  );
}
