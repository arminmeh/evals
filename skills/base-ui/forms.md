# Building forms with Base UI

## Forms

### Field Structure

```tsx
<Field.Root>
  <Field.Label>Email</Field.Label>
  <Field.Control type="email" required />
  <Field.Description>We'll never share your email</Field.Description>
  <Field.Error match="valueMissing">Required</Field.Error>
  <Field.Error match="typeMismatch">Invalid email</Field.Error>
</Field.Root>
```

### Validation Modes

```tsx
// onSubmit (default) - validate on submit, revalidate on change
<Field.Root validationMode="onSubmit">

// onBlur - validate when focus leaves
<Field.Root validationMode="onBlur">

// onChange - real-time (use with debounce for async)
<Field.Root validationMode="onChange" validationDebounceTime={500}>
```

### Custom Validation

```tsx
<Field.Control
  required
  validate={(value) => {
    if (value.length < 3) return "Too short";
    return null; // valid
  }}
/>
```

### Server Errors

```tsx
<Form errors={{ email: "Already taken" }}>
  <Field.Root name="email">
    <Field.Control />
    <Field.Error /> {/* Shows server error */}
  </Field.Root>
</Form>
```

### Checkbox/Radio Groups

```tsx
<Field.Root>
  <Field.Label>Plan</Field.Label>
  <RadioGroup>
    <Field.Item>
      <Field.Label>
        <Radio value="free" /> Free
      </Field.Label>
    </Field.Item>
    <Field.Item>
      <Field.Label>
        <Radio value="pro" /> Pro
      </Field.Label>
    </Field.Item>
  </RadioGroup>
</Field.Root>
```

### Hidden Input Positioning

```tsx
// Wrap in relative container for validation bubble positioning
<div style={{ position: "relative" }}>
  <Select name="country">{/* hidden input positioned near control */}</Select>
</div>
```
