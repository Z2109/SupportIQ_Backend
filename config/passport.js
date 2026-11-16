import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const emailVerified = profile._json?.email_verified === true;

        if (!email || !emailVerified) {
          return done(null, false, {
            message: "Google email is missing or not verified.",
          });
        }

        // Check whether this Google account already exists
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (user) {
          if (!user.isActive) {
            return done(null, false, {
              message: "Your account has been deactivated.",
            });
          }

          return done(null, user);
        }

        // Check whether the email already belongs to a user
        user = await prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          if (!user.isActive) {
            return done(null, false, {
              message: "Your account has been deactivated.",
            });
          }

          // Link Google to the existing account
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              isVerified: true,
            },
          });

          return done(null, user);
        }

        // Create a new Google user
        user = await prisma.user.create({
          data: {
            name: profile.displayName || "Google User",
            email,
            googleId: profile.id,
            isVerified: true,
          },
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;
