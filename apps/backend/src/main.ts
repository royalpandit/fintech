import { Body, Controller, Delete, Get, Module, Param, Post, Put, Query } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

const ok = (data: Record<string, unknown> = {}) => ({ status: true, ...data });

@Controller("api/v1/auth")
class AuthController {
  @Post("register")
  register(@Body() body: Record<string, unknown>) {
    return ok({ token: "mock-jwt", user: body });
  }

  @Post("login")
  login(@Body() body: Record<string, unknown>) {
    return ok({ token: "mock-jwt", user: { emailOrPhone: body.email || body.phone } });
  }

  @Post("logout")
  logout() {
    return ok({ message: "Logged out" });
  }
}

@Controller("api/v1/user")
class UserController {
  @Get("profile")
  getProfile() {
    return ok({ user: { id: 1, name: "Demo User", role: "user" } });
  }

  @Put("profile")
  updateProfile(@Body() body: Record<string, unknown>) {
    return ok({ user: body });
  }
}

@Controller("api/v1/advisor")
class AdvisorController {
  @Post("verify")
  verify(@Body() body: Record<string, unknown>) {
    return ok({ verification_status: "pending", payload: body });
  }

  @Get("status")
  status() {
    return ok({ verification_status: "pending" });
  }

  @Post(":id/subscribe")
  subscribe(@Param("id") id: string) {
    return ok({ advisor_id: Number(id), subscription_status: "active" });
  }
}

@Controller("api/v1/market")
class MarketController {
  @Post("posts")
  createPost(@Body() body: Record<string, unknown>) {
    return ok({ id: Date.now(), compliance_status: "approved", post: body });
  }

  @Get("posts")
  getPosts(@Query() query: Record<string, string>) {
    return ok({ filters: query, data: [] });
  }

  @Post("posts/:id/comment")
  comment(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok({ post_id: Number(id), comment: body });
  }

  @Post("posts/:id/like")
  like(@Param("id") id: string) {
    return ok({ post_id: Number(id), liked: true });
  }

  @Post("posts/:id/report")
  report(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok({ post_id: Number(id), report: body });
  }
}

@Controller("api/v1/community")
class CommunityController {
  @Post("posts")
  createPost(@Body() body: Record<string, unknown>) {
    return ok({ id: Date.now(), post: body });
  }

  @Get("posts")
  getPosts() {
    return ok({ data: [] });
  }

  @Post("follow/:userId")
  follow(@Param("userId") userId: string) {
    return ok({ following: Number(userId) });
  }

  @Delete("unfollow/:userId")
  unfollow(@Param("userId") userId: string) {
    return ok({ unfollowed: Number(userId) });
  }

  @Post("posts/:id/save")
  save(@Param("id") id: string) {
    return ok({ saved_post_id: Number(id) });
  }
}

@Controller("api/v1/portfolio")
class PortfolioController {
  @Post("connect")
  connect(@Body() body: Record<string, unknown>) {
    return ok({ connected: true, broker: body.broker_name });
  }

  @Get()
  getPortfolio() {
    return ok({ total_value: 0, holdings: [] });
  }

  @Get("ai-insights")
  aiInsights() {
    return ok({
      risk_score: 7.5,
      diversification_score: 60,
      suggested_rebalance: ["Reduce sector concentration", "Increase debt/gold allocation"],
      sector_exposure: [],
    });
  }

  @Post("manual-add")
  manualAdd(@Body() body: Record<string, unknown>) {
    return ok({ asset: body });
  }

  @Get("performance")
  performance() {
    return ok({ points: [] });
  }
}

@Controller("api/v1/lab")
class LabController {
  @Post("create")
  create() {
    return ok({ virtual_balance: 1000000 });
  }

  @Get("balance")
  balance() {
    return ok({ balance: 1000000 });
  }

  @Post("trade")
  trade(@Body() body: Record<string, unknown>) {
    return ok({ trade: body, executed: true });
  }

  @Get("portfolio")
  portfolio() {
    return ok({ data: [] });
  }

  @Get("leaderboard")
  leaderboard() {
    return ok({ data: [] });
  }
}

@Controller("api/v1/ai")
class AiController {
  @Post("chat")
  chat(@Body() body: Record<string, unknown>) {
    return ok({ answer: "Informational response generated.", confidence_score: 0.92, context: body.context });
  }

  @Post("risk-profile")
  riskProfile(@Body() body: Record<string, unknown>) {
    return ok({ risk_score: 6.8, risk_level: "moderate", input: body });
  }

  @Get("expense-analysis")
  expenseAnalysis() {
    return ok({ suggestions: ["Reduce discretionary spend by 15%"], anomalies: [] });
  }
}

@Controller("api/v1/finance")
class FinanceController {
  @Post("connect-upi")
  connectUpi(@Body() body: Record<string, unknown>) {
    return ok({ connected: true, provider: body.provider ?? "upi" });
  }

  @Get("transactions")
  transactions() {
    return ok({ data: [] });
  }

  @Post("categorize")
  categorize(@Body() body: Record<string, unknown>) {
    return ok({ category: "general", input: body });
  }

  @Post("budget")
  budget(@Body() body: Record<string, unknown>) {
    return ok({ budget: body });
  }

  @Get("monthly-report")
  monthlyReport() {
    return ok({ total_spent: 0, recommendations: [] });
  }
}

@Controller("api/v1/courses")
class CourseController {
  @Post("create")
  create(@Body() body: Record<string, unknown>) {
    return ok({ course_id: Date.now(), course: body });
  }

  @Get()
  list() {
    return ok({ data: [] });
  }

  @Post(":id/purchase")
  purchase(@Param("id") id: string) {
    return ok({ course_id: Number(id), purchased: true });
  }
}

@Controller("api/v1/notifications")
class NotificationController {
  @Get()
  list() {
    return ok({ data: [] });
  }

  @Post("read")
  read(@Body() body: { ids?: number[] }) {
    return ok({ marked_read: body.ids ?? [] });
  }
}

@Controller("api/v1/admin")
class AdminController {
  @Post("advisor/:id/approve")
  approveAdvisor(@Param("id") id: string) {
    return ok({ advisor_id: Number(id), verification_status: "approved" });
  }

  @Post("posts/:id/moderate")
  moderatePost(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return ok({ post_id: Number(id), moderation: body });
  }

  @Get("reports")
  reports() {
    return ok({ data: [] });
  }

  @Get("audit-logs")
  auditLogs() {
    return ok({ data: [] });
  }
}

@Controller("api/v1/moderation")
class ModerationController {
  @Post("analyze")
  analyze(@Body() body: { content?: string }) {
    const text = (body.content || "").toLowerCase();
    const blocked = ["guaranteed returns", "100% safe", "no risk", "buy now before it explodes"];
    const hit = blocked.find((w) => text.includes(w));
    return ok({
      risk_level: hit ? "high" : "low",
      status: hit ? "flagged" : "approved",
      reason: hit ? `Blocked phrase detected: ${hit}` : "No critical compliance issue detected",
    });
  }
}

@Controller("api/v1")
class HealthController {
  @Get("health")
  health() {
    return ok({ service: "flexi-backend", uptime: process.uptime() });
  }
}

@Module({
  controllers: [
    AuthController,
    UserController,
    AdvisorController,
    MarketController,
    CommunityController,
    PortfolioController,
    LabController,
    AiController,
    FinanceController,
    CourseController,
    NotificationController,
    AdminController,
    ModerationController,
    HealthController,
  ],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT || 4000);
}

bootstrap();
