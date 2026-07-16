import nodemailer from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
console.log(await dns.promises.lookup("smtp.gmail.com", { all: true }));

console.log(process.version);
console.log(process.platform);
console.log(process.arch);
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_APP_PASSWORD,
    },
});

export async function sendTestLinkEmail(candidate) {
    const info = await transporter.sendMail({
        from: `"Recruitment Team" <${process.env.SMTP_EMAIL}>`,
        to: candidate.email,
        subject: "Next Step: Assessment Link",
        html: `
      <p>Hi ${candidate.name || ""},</p>
      <p>Congratulations on being shortlisted for the next round. Please complete the assessment below:</p>
      <p><a href="${process.env.TEST_LINK_URL}">${process.env.TEST_LINK_URL}</a></p>
      <p>Best,<br/>Recruitment Team</p>
    `,
    });
    return info;
}

export async function sendInterviewInviteEmail(candidate) {
    const info = await transporter.sendMail({
        from: `"Recruitment Team" <${process.env.SMTP_EMAIL}>`,
        to: candidate.email,
        subject: "Interview Scheduled",
        html: `
      <p>Hi ${candidate.name || ""},</p>
      <p>Your interview has been scheduled for <strong>${candidate.interview.scheduledAt}</strong>.</p>
      <p>Join via Google Meet: <a href="${candidate.interview.googleMeetLink}">${candidate.interview.googleMeetLink}</a></p>
      <p>Best,<br/>Recruitment Team</p>
    `,
    });
    return info;
}

try {
    await transporter.verify();
    console.log("SMTP verified");
} catch (err) {
    console.error("SMTP verify failed:", err);
}

export default { sendTestLinkEmail, sendInterviewInviteEmail };