import { forwardRef } from "react";

const MyButton = forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button">>(
  function MyButton(props, ref) {
    return <button ref={ref} {...props} className="my-button" />;
  }
);

export default function App() {
  return (
    <div>
      <h1>My App</h1>
      {/* TODO: Add a Base UI Menu with the trigger composed with MyButton */}
    </div>
  );
}
