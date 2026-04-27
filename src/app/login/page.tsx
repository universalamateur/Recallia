import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <section className="login-page">
      <div>
        <p className="eyebrow">Demo login</p>
        <h1>Recallia</h1>
        <p className="lead">Turn scattered life memories into a connected timeline.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </section>
  );
}
