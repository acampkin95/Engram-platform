import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-void">
      <SignUp
        appearance={{
          baseTheme: {
            // @ts-expect-error
            // @ts-expect-error
            colors: {
              background: '#03020a',
              pageBackground: '#03020a',
              appBorder: 'rgba(255, 255, 255, 0.06)',
              appShadow: 'rgba(242, 169, 59, 0.25)',
              textColor: '#f0eef8',
              textColorSubText: '#a09bb8',
              primaryColor: '#f2a93b',
            },
          },
          variables: {
            colorBackground: '#03020a',
            colorPrimary: '#f2a93b',
            colorText: '#f0eef8',
            // @ts-expect-error
            // @ts-expect-error
            colorTextPlaceholder: '#a09bb8',
            colorInputBackground: 'rgba(255, 255, 255, 0.08)',
            colorBorder: 'rgba(255, 255, 255, 0.06)',
          },
        }}
      />
    </div>
  );
}
