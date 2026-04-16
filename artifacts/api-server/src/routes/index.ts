import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use("/stripe", stripeRouter);

export default router;
