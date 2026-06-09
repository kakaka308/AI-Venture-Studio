"use client"

import { useState} from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // 阻止浏览器默认的表单提交刷新行为
    setError("");       
    setLoading(true);  

    if (isLogin) { 
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("邮箱或者密码错误");
      } else {
        router.push("./dashboard");
      }
    } else {
      // 请求后端的注册 API 接口
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (res.ok) {
        // 注册成功后，内部调用登录
        await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        router.push("/dashboard"); 
      } else {
        // 注册失败
        const data = await res.json();
        setError(data.error || "注册失败");
      }
    }
    setLoading(false);
  }

    return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-96 space-y-4">
        <h1 className="text-2xl font-bold">{isLogin ? "登录" : "注册"}</h1>
        {!isLogin && (
          <input
            type="text"
            placeholder="昵称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 rounded"
          />
        )}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
        >
          {loading ? "处理中..." : isLogin ? "登录" : "注册"}
        </button>
        <p className="text-sm text-center">
          {isLogin ? "没有账号？" : "已有账号？"}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 ml-1"
          >
            {isLogin ? "去注册" : "去登录"}
          </button>
        </p>
      </form>
    </div>
  );

}