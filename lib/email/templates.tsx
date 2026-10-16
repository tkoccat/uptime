import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

type Props = {
  lang: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer: string;
};

// Tüm işlemsel e-postaların ortak şablonu; metinler locales/email.*.json içindedir
export function BasicEmail({ lang, heading, body, ctaLabel, ctaUrl, footer }: Props) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={{ backgroundColor: "#f4f6fa", fontFamily: "Arial, Helvetica, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: 8, maxWidth: 520, margin: "0 auto", padding: "32px" }}
        >
          <Heading as="h1" style={{ fontSize: 22, color: "#0b1b3a", margin: "0 0 16px" }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: "24px", color: "#26334d" }}>{body}</Text>
          {ctaLabel && ctaUrl && (
            <Button
              href={ctaUrl}
              style={{
                backgroundColor: "#0f8a7e",
                color: "#ffffff",
                borderRadius: 6,
                padding: "12px 20px",
                fontSize: 15,
                textDecoration: "none",
                display: "inline-block",
                marginTop: 8,
              }}
            >
              {ctaLabel}
            </Button>
          )}
          <Hr style={{ borderColor: "#e3e8f0", margin: "28px 0 16px" }} />
          <Text style={{ fontSize: 12, color: "#6b7893" }}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
