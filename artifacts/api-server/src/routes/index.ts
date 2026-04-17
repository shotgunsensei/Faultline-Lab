import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import stripeRouter from "./stripe";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(adminRouter);
router.use("/stripe", stripeRouter);

export default router;
